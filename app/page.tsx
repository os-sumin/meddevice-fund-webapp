"use client";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { clientDb } from "@/lib/firebaseClient";

const AGENTS = [
  { id: "fund-benchmark", title: "정책펀드 사례조사" },
  { id: "market-research", title: "의료기기 시장조사" },
  { id: "multiplier-simulator", title: "승수효과 시뮬레이터" },
];

type AgentDoc = {
  status?: "pending" | "running" | "done" | "error";
  title?: string;
  result?: { summary?: string; rows?: unknown[]; sources?: string[] };
  error?: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  running: "조사 중…",
  done: "완료",
  error: "오류",
};

export default function Dashboard() {
  const [runId, setRunId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Record<string, AgentDoc>>({});
  const [busy, setBusy] = useState(false);

  // run 하위 agents 컬렉션 실시간 구독
  useEffect(() => {
    if (!runId) return;
    const unsub = onSnapshot(collection(clientDb, `runs/${runId}/agents`), (snap) => {
      const next: Record<string, AgentDoc> = {};
      snap.forEach((d) => (next[d.id] = d.data() as AgentDoc));
      setAgents(next);
    });
    return () => unsub();
  }, [runId]);

  async function runAll() {
    setBusy(true);
    setAgents({});
    const res = await fetch("/api/orchestrate", { method: "POST", body: JSON.stringify({}) });
    const { runId } = await res.json();
    setRunId(runId);
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>의료기기 정책펀드 에이전트</h1>
      <p style={{ color: "#666", marginTop: 4 }}>
        오케스트레이터가 에이전트를 병렬 실행하고, 아래 카드가 Firestore 실시간으로 갱신됩니다.
      </p>

      <button
        onClick={runAll}
        disabled={busy}
        style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, background: "#1F3864", color: "#fff", border: 0 }}
      >
        {busy ? "시작 중…" : "전체 실행"}
      </button>

      <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
        {AGENTS.map((a) => {
          const d = agents[a.id];
          const status = d?.status ?? "-";
          return (
            <div key={a.id} style={{ border: "1px solid #e2e2e2", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{a.title}</strong>
                <span style={{ fontSize: 13, color: status === "done" ? "#137333" : status === "error" ? "#c5221f" : "#888" }}>
                  {STATUS_LABEL[status] ?? "미실행"}
                </span>
              </div>
              {d?.result?.summary && (
                <p style={{ marginTop: 10, fontSize: 14, whiteSpace: "pre-wrap" }}>{d.result.summary}</p>
              )}
              {d?.result?.rows && d.result.rows.length > 0 && (
                <p style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                  {d.result.rows.length}개 행 · 출처 {d.result.sources?.length ?? 0}건
                </p>
              )}
              {d?.error && <p style={{ marginTop: 8, fontSize: 13, color: "#c5221f" }}>{d.error}</p>}
            </div>
          );
        })}
      </div>
    </main>
  );
}
