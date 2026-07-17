# 의료기기 정책펀드 에이전트 웹앱

EnF의 의료기기 정책펀드 용역 지원 에이전트 3종을 웹에서 실행하는 Next.js 앱.
각 에이전트 = API 라우트, 오케스트레이터 = `/api/orchestrate`, 상태·결과 저장 = Firestore(실시간 대시보드).

## 구조

```
skills/                  ← SKILL.md 3개(프롬프트 원본). 에이전트 로직의 단일 소스
lib/ai.ts                ← provider-agnostic 모델 선택(기본 GPT, env로 Claude 교체)
lib/agents.ts            ← 에이전트 레지스트리 + 스킬 프롬프트 로더
lib/simulator.ts         ← ③ 승수효과 계산(LLM 아님, 결정적 코드)
lib/firebaseAdmin.ts     ← 서버에서 Firestore 쓰기
lib/firebaseClient.ts    ← 브라우저 실시간 구독
app/api/agents/[id]/     ← 에이전트 실행(리서치=모델+웹서치, 계산=simulator)
app/api/orchestrate/     ← run 생성 + 에이전트 병렬 트리거
app/page.tsx             ← 대시보드(카드 + 전체 실행 + 실시간 상태)
```

**핵심**: 스킬 3폴더는 그대로 못 올린다. 이 앱이 스킬 `.md`를 **시스템 프롬프트로 읽어** 모델을 호출한다.
스킬을 고치면 앱 동작도 바뀌는 단일 소스 구조.

## 배포 (깃허브 → Vercel)

1. 이 폴더를 레포로 만들어 push:
   ```bash
   git init && git add . && git commit -m "init" && git branch -M main
   git remote add origin https://github.com/<you>/meddevice-fund-webapp.git
   git push -u origin main
   ```
2. vercel.com → **Add New → Project → 이 레포 Import**.
3. **Settings → Environment Variables**에 `.env.example` 항목을 채워 넣는다(키는 절대 커밋하지 않음).
4. **Fluid compute** 켜져 있는지 확인(신규 프로젝트 기본 on). Hobby면 maxDuration 상한이 300초이므로
   `vercel.json`의 800을 300으로 낮춘다. Pro면 800 그대로.
5. Deploy. 이후 `main`에 push할 때마다 자동 재배포.

## 사전 준비

- **Firebase**: 프로젝트 생성 → Firestore 사용 설정 → 서비스계정 키 발급(서버 env). 웹앱 등록해 클라이언트 config(NEXT_PUBLIC_*) 확보.
- **모델 키**: `OPENAI_API_KEY`(기본). 특정 에이전트만 Claude로 돌리려면 `AGENT_MODELS`와 `ANTHROPIC_API_KEY` 추가.
- `OPENAI_MODEL`은 실제 사용 가능한 모델명으로 맞춘다(현재 값은 예시).

## 확인/조정 필요 (스캐폴드 한계)

- 웹서치 툴 함수명(`openai.tools.webSearch` / `anthropic.tools.webSearch_20250305`)은 설치한 AI SDK
  버전에 맞게 확인. SDK가 자주 업데이트되므로 `npm i` 후 타입 에러 나오면 문서대로 조정.
- Excel 내보내기: 리서치 결과 rows를 Firestore에 저장하고 있으므로, `/api/export`에 exceljs로 xlsx
  생성 라우트를 추가하면 됨(파이썬 `build_workbook.py` 로직 포팅). 또는 Storage에 저장.
- ③ 계산 에이전트 input은 `lib/simulator.ts`의 `SimConfig` 형태 JSON을 대시보드에서 입력받게 폼 추가.
- 오케스트레이션이 800초를 넘길 위험이 있으면 Vercel Workflows로 승급.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```
