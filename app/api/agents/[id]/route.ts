import { NextRequest, NextResponse } from "next/server";
import { getAgent, loadSkillPrompt } from "@/lib/agents";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) return NextResponse.json({ error: "unknown agent" }, { status: 404 });

  const { runId, input } = await req.json();
  const ref = db().doc(`runs/${runId}/agents/${id}`);
  await ref.set({ status: "running", title: agent.title, startedAt: Date.now() }, { merge: true });

  try {
    if (agent.kind === "compute") {
      const { simulate, DEFAULT_SIM_CONFIG } = await import("@/lib/simulator");
      const cfg = input && typeof input === "object" ? input : DEFAULT_SIM_CONFIG;
      const result = simulate(cfg);
      await ref.set({ status: "done", result, finishedAt: Date.now() }, { merge: true });
      return NextResponse.json({ ok: true, result });
    }

    const system = loadSkillPrompt(agent);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 8000,
        system,
        messages: [{ role: "user", content: input || "명세의 기본 조사범위로 수행하라." }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 500));

    // 최종 텍스트 = text 블록만 모으기 (검색 과정 블록은 제외)
    const blocks = Array.isArray(data.content) ? data.content : [];
    const text = blocks
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    // 실제 검색된 출처 URL 수집
    const sources: string[] = [];
    for (const b of blocks) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) if (r?.url) sources.push(r.url);
      }
    }

    const clean = text.replace(/```json|```/g, "").trim();
    let result: { summary?: string; rows?: unknown[]; sources?: string[] };
    try {
      result = JSON.parse(clean);
    } catch {
      result = { summary: text, rows: [] };
    }
    result.sources = Array.from(new Set([...(result.sources || []), ...sources]));

    await ref.set({ status: "done", result, finishedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";
    await ref.set({ status: "error", error: message, finishedAt: Date.now() }, { merge: true });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}