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

  const { runId, input, previous } = await req.json();
  const ref = db().doc(`runs/${runId}/agents/${id}`);
  await ref.set({ status: "running", title: agent.title, startedAt: Date.now() }, { merge: true });

  try {
    // 계산 에이전트: 모델 호출 없이 결정적 계산
    if (agent.kind === "compute") {
      const { simulate, DEFAULT_SIM_CONFIG } = await import("@/lib/simulator");
      let cfg = DEFAULT_SIM_CONFIG;
      if (input && typeof input === "string" && input.trim().startsWith("{")) {
        try { cfg = JSON.parse(input); } catch { /* 기본값 사용 */ }
      } else if (input && typeof input === "object") {
        cfg = input;
      }
      const result = simulate(cfg);
      await ref.set({ status: "done", result, finishedAt: Date.now() }, { merge: true });
      return NextResponse.json({ ok: true, result });
    }

    const system = loadSkillPrompt(agent);
    const userContent =
      (input && String(input).trim() ? String(input) : "명세의 기본 조사범위로 수행하라.") +
      (previous
        ? `\n\n[이전 결과]\n${JSON.stringify(previous).slice(0, 40000)}\n\n` +
          `위 결과를 출발점으로 삼아라. 이미 검증된 내용은 유지하고, 위 지시사항에 따라 ` +
          `추가 조사·수정·심화한 뒤 전체 JSON을 다시 완성해 출력하라.`
        : "");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 12000,
        system,
        messages: [{ role: "user", content: userContent }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 15 }],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 500));

    const blocks: Array<Record<string, unknown>> = Array.isArray(data.content) ? data.content : [];
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => String(b.text || ""))
      .join("\n");

    const sources: string[] = [];
    for (const b of blocks) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content as Array<{ url?: string }>) {
          if (r?.url) sources.push(r.url);
        }
      }
    }

    // JSON 추출 (펜스 제거 + 첫 { ~ 마지막 } )
    let result: { summary?: string; rows?: unknown[]; sources?: string[] };
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const s = clean.indexOf("{");
    const e = clean.lastIndexOf("}");
    try {
      result = JSON.parse(s >= 0 && e > s ? clean.slice(s, e + 1) : clean);
    } catch {
      result = { summary: text, rows: [] };
    }
    if (!Array.isArray(result.rows)) result.rows = [];
    result.sources = Array.from(new Set([...(result.sources || []), ...sources]));

    await ref.set({ status: "done", result, finishedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";
    await ref.set({ status: "error", error: message, finishedAt: Date.now() }, { merge: true });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}