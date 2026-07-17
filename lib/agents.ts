// 에이전트 레지스트리. 새 에이전트를 추가하려면 여기 한 줄 + skills/에 .md 넣으면 끝.
import fs from "node:fs";
import path from "node:path";

export type AgentDef = {
  id: string;
  title: string;
  skillFile: string; // skills/ 아래 파일명 (SKILL.md 프롬프트 원본)
  usesWebSearch: boolean;
  kind: "research" | "compute";
};

export const AGENTS: AgentDef[] = [
  {
    id: "fund-benchmark",
    title: "정책펀드 사례조사",
    skillFile: "fund-benchmark.md",
    usesWebSearch: true,
    kind: "research",
  },
  {
    id: "market-research",
    title: "의료기기 시장조사",
    skillFile: "market-research.md",
    usesWebSearch: true,
    kind: "research",
  },
  {
    id: "multiplier-simulator",
    title: "승수효과 시뮬레이터",
    skillFile: "multiplier-simulator.md",
    usesWebSearch: false,
    kind: "compute",
  },
];

export function getAgent(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}

// 스킬 md를 시스템 프롬프트로 로드. 이게 SKILL.md를 Vercel 에이전트로 재활용하는 핵심 지점.
export function loadSkillPrompt(agent: AgentDef): string {
  const p = path.join(process.cwd(), "skills", agent.skillFile);
  const md = fs.readFileSync(p, "utf-8");
  return [
    "너는 EnF Advisor의 의료기기 정책펀드 용역을 지원하는 전문 에이전트다.",
    "아래 명세(SKILL)의 워크플로우·핵심원칙·출력형식을 반드시 따른다.",
    "리서치 결과의 바뀌는 수치(규모·집행액 등)는 web_search로 최신값을 확인하고 출처 URL을 남긴다.",
    "최종 응답은 반드시 다음 JSON만 출력한다(설명·마크다운펜스 없이): ",
    '{ "summary": "<핵심 요약 3~5줄>", "rows": [ <표 행 객체들> ], "sources": [ "<url>" ] }',
    "\n\n===== SKILL 명세 =====\n",
    md,
  ].join("\n");
}
