// 서버 라우트에서 Firestore에 쓸 때 사용. 서비스계정 키는 env로 주입(레포에 커밋 금지).
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function init() {
  if (getApps().length) return;
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // env엔 \n 이스케이프로 들어오므로 복원
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export function db() {
  init();
  return getFirestore();
}

// 실행 1건을 나타내는 문서 경로: runs/{runId}/agents/{agentId}
export type AgentStatus = "pending" | "running" | "done" | "error";
