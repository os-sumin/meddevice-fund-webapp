import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getAgent, loadSkillPrompt } from "@/lib/agents";
import { getModel } from "@/lib/ai";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/agents/{id}  body: { runId, input }
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
    // 계산 에이전트: 모델을 부르지 않고 결정적 계산을 실행한다.
    if (agent.kind === "compute") {
      const { simulate, DEFAULT_SIM_CONFIG } = await import("@/lib/simulator");
      const cfg = input && typeof input === "object" ? input : DEFAULT_SIM_CONFIG;
      const result = simulate(cfg);
      await ref.set({ status: "done", result, finishedAt: Date.now() }, { merge: true });
      return NextResponse.json({ ok: true, result });
    }

    const system = loadSkillPrompt(agent);
    const { text } = await generateText({
      model: getModel(id),
      system,
      prompt: input || "명세의 기본 조사범위로 수행하라.",
    });

    const clean = text.replace(/```json|```/g, "").trim();
    let result: unknown;
    try {
      result = JSON.parse(clean);
    } catch {
      result = { summary: text, rows: [], sources: [] };
    }

    await ref.set({ status: "done", result, finishedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";
    await ref.set({ status: "error", error: message, finishedAt: Date.now() }, { merge: true });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
