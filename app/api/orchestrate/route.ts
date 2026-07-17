import { NextRequest, NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/orchestrate  body: { agentIds?: string[], inputs?: Record<string,string> }
// run 문서를 만들고 각 에이전트를 비동기로 던진다. 대시보드는 Firestore 실시간 구독으로 진행상황을 본다.
// 참고: 전체 오케스트레이션이 800초를 넘길 것 같으면 Vercel Workflows로 승급.
export async function POST(req: NextRequest) {
  const { agentIds, inputs } = await req.json().catch(() => ({}));
  const targets = (agentIds && agentIds.length ? agentIds : AGENTS.map((a) => a.id)) as string[];

  const runId = `run_${Date.now()}`;
  await db().doc(`runs/${runId}`).set({
    createdAt: Date.now(),
    agentIds: targets,
    status: "running",
  });
  // 각 에이전트 문서를 pending으로 미리 생성 (대시보드가 즉시 카드 표시)
  await Promise.all(
    targets.map((id) =>
      db().doc(`runs/${runId}/agents/${id}`).set({ status: "pending" }, { merge: true })
    )
  );

  const origin = req.nextUrl.origin;
  // fire-and-forget: 각 에이전트 라우트를 비동기 호출. await하지 않고 던진다.
  targets.forEach((id) => {
    fetch(`${origin}/api/agents/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, input: inputs?.[id] }),
    }).catch(() => {});
  });

  return NextResponse.json({ runId });
}
