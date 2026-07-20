"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { clientDb } from "@/lib/firebaseClient";

const AGENTS = [
  { id: "fund-benchmark", title: "정책펀드 사례조사" },
  { id: "market-research", title: "의료기기 시장조사" },
  { id: "multiplier-simulator", title: "승수효과 시뮬레이터" },
];

const LABELS: Record<string, string> = {
  fund: "펀드명", region: "구분", authority: "소관", year: "연도", size: "규모",
  funding_structure: "재원구조", risk_sharing: "리스크분담", governance: "거버넌스",
  gov_type: "유형", mandate: "주목적 투자의무", term_exit: "존속·회수",
  multiplier: "승수", meddevice_implication: "의료기기 시사점", source: "출처",
  category: "구분", metric: "지표", value: "값", unit: "단위",
  source_org: "출처기관", url: "URL", thesis: "논거 연결", note: "비고",
  name: "시나리오", gov: "정부출자", private: "민간출자", total: "총 결성",
  first_loss: "first-loss", first_loss_pct: "first-loss %", private_cover: "민간커버",
};

type Result = { summary?: string; rows?: Record<string, unknown>[]; sources?: string[] };
type AgentDoc = { status?: string; result?: Result; error?: string };

const STATUS: Record<string, { t: string; c: string }> = {
  running: { t: "실행 중…", c: "#b06000" },
  done: { t: "완료", c: "#137333" },
  error: { t: "오류", c: "#c5221f" },
};

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
  }
  if (typeof v === "object") return "";
  return String(v);
}

export default function Dashboard() {
  const runId = useMemo(() => `run_${Date.now()}`, []);
  const [tab, setTab] = useState(AGENTS[0].id);
  const [agents, setAgents] = useState<Record<string, AgentDoc>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = onSnapshot(collection(clientDb, `runs/${runId}/agents`), (snap) => {
      const next: Record<string, AgentDoc> = {};
      snap.forEach((d) => (next[d.id] = d.data() as AgentDoc));
      setAgents(next);
    });
    return () => unsub();
  }, [runId]);

  async function run(id: string, refine: boolean) {
    setAgents((p) => ({ ...p, [id]: { ...p[id], status: "running", error: undefined } }));
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId,
          input: inputs[id] || "",
          previous: refine ? agents[id]?.result : undefined,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        setAgents((p) => ({ ...p, [id]: { ...p[id], status: "error", error: t.slice(0, 400) } }));
      }
    } catch (e) {
      setAgents((p) => ({
        ...p,
        [id]: { ...p[id], status: "error", error: e instanceof Error ? e.message : "오류" },
      }));
    }
  }

  async function download(id: string, format: "xlsx" | "doc") {
    const a = AGENTS.find((x) => x.id === id)!;
    const r = agents[id]?.result;
    if (!r) return;
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: a.title, format, ...r }),
    });
    if (!res.ok) {
      alert("내보내기 실패: " + (await res.text()).slice(0, 200));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `${a.title}.${format === "xlsx" ? "xlsx" : "doc"}`;
    el.click();
    URL.revokeObjectURL(url);
  }

  const d = agents[tab];
  const r = d?.result;
  const rows = (r?.rows || []).filter((x) => x && typeof x === "object");
  // 중첩 객체 컬럼은 표에서 제외
  const cols = Array.from(new Set(rows.flatMap((x) => Object.keys(x)))).filter((c) =>
    rows.some((x) => x[c] !== null && x[c] !== undefined && typeof x[c] !== "object")
  );
  const busy = d?.status === "running";
  const st = STATUS[d?.status || ""];

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px 60px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>의료기기 정책펀드 에이전트</h1>
      <p style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
        에이전트를 개별 실행하고, 결과 위에 지시를 얹어 반복 심화할 수 있습니다.
      </p>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 6, marginTop: 16, borderBottom: "1px solid #ddd" }}>
        {AGENTS.map((a) => {
          const s = agents[a.id]?.status;
          const on = tab === a.id;
          return (
            <button key={a.id} onClick={() => setTab(a.id)}
              style={{
                padding: "10px 16px", border: 0, cursor: "pointer", fontSize: 14,
                background: on ? "#1F3864" : "transparent", color: on ? "#fff" : "#333",
                borderRadius: "8px 8px 0 0", fontWeight: on ? 600 : 400,
              }}>
              {a.title}
              {s && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.85 }}>
                {s === "done" ? "●" : s === "error" ? "✕" : "…"}
              </span>}
            </button>
          );
        })}
      </div>

      {/* 지시 + 실행 */}
      <div style={{ marginTop: 16 }}>
        <textarea
          value={inputs[tab] || ""}
          onChange={(e) => setInputs((p) => ({ ...p, [tab]: e.target.value }))}
          placeholder="지시사항 (예: 사이버보안 펀드의 GP 선정방식과 주목적 투자의무를 더 깊이 조사하고, 미국 SBIR은 펀드가 아니므로 제외)"
          style={{ width: "100%", minHeight: 70, padding: 10, fontSize: 13, borderRadius: 8, border: "1px solid #ccc", fontFamily: "inherit", resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => run(tab, false)} disabled={busy}
            style={{ padding: "9px 18px", borderRadius: 6, background: "#1F3864", color: "#fff", border: 0, cursor: busy ? "default" : "pointer" }}>
            {busy ? "실행 중…" : "실행"}
          </button>
          <button onClick={() => run(tab, true)} disabled={busy || !r}
            style={{ padding: "9px 18px", borderRadius: 6, background: "#fff", color: "#1F3864", border: "1px solid #1F3864", cursor: !r || busy ? "default" : "pointer", opacity: !r ? 0.5 : 1 }}>
            이 결과 보완
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => download(tab, "xlsx")} disabled={!r}
            style={{ padding: "9px 14px", borderRadius: 6, background: "#137333", color: "#fff", border: 0, opacity: !r ? 0.4 : 1 }}>
            Excel 다운로드
          </button>
          <button onClick={() => download(tab, "doc")} disabled={!r}
            style={{ padding: "9px 14px", borderRadius: 6, background: "#2b579a", color: "#fff", border: 0, opacity: !r ? 0.4 : 1 }}>
            Word 다운로드
          </button>
          {st && <span style={{ fontSize: 13, color: st.c, marginLeft: 4 }}>{st.t}</span>}
        </div>
      </div>

      {d?.error && (
        <div style={{ marginTop: 14, padding: 12, background: "#fce8e6", color: "#c5221f", borderRadius: 8, fontSize: 13, maxHeight: 160, overflow: "auto" }}>
          {d.error}
        </div>
      )}

      {/* 요약 */}
      {r?.summary && (
        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 15, margin: "0 0 6px" }}>요약</h2>
          <div style={{ padding: 12, background: "#f6f8fc", borderRadius: 8, fontSize: 13.5, lineHeight: 1.7, maxHeight: 220, overflowY: "auto", whiteSpace: "pre-wrap" }}>
            {r.summary}
          </div>
        </section>
      )}

      {/* 표 */}
      {rows.length > 0 && (
        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 15, margin: "0 0 6px" }}>결과 ({rows.length}건)</h2>
          <div style={{ maxHeight: "55vh", overflow: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 12.5, width: "100%" }}>
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c} style={{
                      position: "sticky", top: 0, background: "#1F3864", color: "#fff",
                      padding: "9px 10px", textAlign: "left", whiteSpace: "nowrap",
                      borderRight: "1px solid #35507f", zIndex: 1,
                    }}>{LABELS[c] || c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 ? "#fafbfd" : "#fff" }}>
                    {cols.map((c) => {
                      const isUrl = typeof row[c] === "string" && String(row[c]).startsWith("http");
                      return (
                        <td key={c} style={{
                          padding: "9px 10px", borderTop: "1px solid #eee", verticalAlign: "top",
                          minWidth: 90, maxWidth: 320, lineHeight: 1.6, wordBreak: "break-word",
                        }}>
                          {isUrl
                            ? <a href={String(row[c])} target="_blank" rel="noreferrer" style={{ color: "#1a73e8" }}>링크</a>
                            : fmt(row[c])}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 출처 */}
      {r?.sources && r.sources.length > 0 && (
        <section style={{ marginTop: 16 }}>
          <details>
            <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              출처 {r.sources.length}건
            </summary>
            <ul style={{ maxHeight: 200, overflowY: "auto", fontSize: 12, marginTop: 8 }}>
              {r.sources.map((s, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <a href={s} target="_blank" rel="noreferrer" style={{ color: "#1a73e8", wordBreak: "break-all" }}>{s}</a>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </main>
  );
}