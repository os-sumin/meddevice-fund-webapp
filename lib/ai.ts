// provider-agnostic 모델 선택. 기본은 Claude.
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

type Provider = "openai" | "anthropic";

const DEFAULT_PROVIDER = (process.env.AI_PROVIDER as Provider) || "anthropic";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

// 에이전트별 오버라이드. AGENT_MODELS='{"fund-benchmark":"openai"}' 형태.
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