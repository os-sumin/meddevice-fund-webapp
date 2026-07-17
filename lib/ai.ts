// provider-agnostic 모델 선택.
// 에이전트별로 다른 모델을 쓰고 싶으면 getModel(agentId)에 매핑을 추가하면 됨.
// 기본은 GPT. env(AI_PROVIDER)로 전역 스위치, 또는 AGENT_MODELS로 에이전트별 오버라이드.
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

type Provider = "openai" | "anthropic";

const DEFAULT_PROVIDER = (process.env.AI_PROVIDER as Provider) || "openai";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4"; // 실제 사용 가능한 모델명으로 조정
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// 에이전트별 오버라이드 (예: 사례조사 에이전트만 Claude로).
// AGENT_MODELS='{"fund-benchmark":"anthropic"}' 형태로 env에 넣으면 파싱됨.
function agentOverride(agentId: string): Provider | undefined {
  try {
    const raw = process.env.AGENT_MODELS;
    if (!raw) return undefined;
    const map = JSON.parse(raw) as Record<string, Provider>;
    return map[agentId];
  } catch {
    return undefined;
  }
}

export function getModel(agentId?: string) {
  const provider = (agentId && agentOverride(agentId)) || DEFAULT_PROVIDER;
  return provider === "anthropic"
    ? anthropic(ANTHROPIC_MODEL)
    : openai(OPENAI_MODEL);
}

// 서버사이드 웹서치 툴. provider마다 내장 웹서치 툴이 다르므로 여기서 흡수한다.
// - OpenAI: Responses API의 web_search 툴
// - Anthropic: web_search 툴
// 리서치 에이전트(①②)만 사용. 계산 에이전트(③)는 웹서치 불필요.
export function webSearchTools(agentId?: string) {
  const provider = (agentId && agentOverride(agentId)) || DEFAULT_PROVIDER;
  if (provider === "anthropic") {
    // 설치된 SDK 버전의 정확한 함수명으로 맞출 것. GPT만 쓸 거면 이 분기는 안 탐.
    return {};
  }
  return { web_search: openai.tools.webSearch({}) };
}
