import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 진단용: 서버가 어떤 env를 실제로 보고 있는지 확인. 값은 노출하지 않고 존재 여부만.
export async function GET() {
  const key = process.env.FIREBASE_PRIVATE_KEY || "";
  return NextResponse.json({
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "(없음)",
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "있음" : "(없음)",
    PRIVATE_KEY_길이: key.length,
    PRIVATE_KEY_시작: key.slice(0, 30),
    PRIVATE_KEY_줄바꿈문자포함: key.includes("\\n"),
    OPENAI_MODEL: process.env.OPENAI_MODEL || "(없음)",
    OPENAI_KEY: process.env.OPENAI_API_KEY ? "있음" : "(없음)",
  });
}