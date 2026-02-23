# AI Assistant Chatbot

Claude API를 활용한 AI 개인 비서 챗봇 애플리케이션입니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Database | PostgreSQL + Prisma 7 ORM (`@prisma/adapter-pg`) |
| 실시간 스트리밍 | Server-Sent Events (SSE) |
| 인프라 | Docker (PostgreSQL 컨테이너) |

## 주요 기능

- 실시간 스트리밍 응답 (SSE)
- 대화 히스토리 저장 및 관리
- 여러 대화 세션 관리 (상단 드롭다운 전환)
- 첫 메시지 기반 대화 제목 자동 생성
- 대화별 시스템 프롬프트 설정 (AI 역할 커스터마이징)

## 프로젝트 구조

```
├── app/
│   ├── layout.tsx               # 루트 레이아웃
│   ├── page.tsx                 # 진입점 (Server Component)
│   ├── globals.css              # 전역 스타일 + 애니메이션
│   └── api/
│       ├── chat/route.ts        # SSE 스트리밍 채팅 엔드포인트
│       └── conversations/
│           ├── route.ts         # 대화 목록 조회/생성
│           └── [id]/route.ts    # 대화 조회/수정/삭제
│
├── components/
│   ├── ChatInterface.tsx        # 최상위 클라이언트 컴포넌트
│   ├── ConversationHeader.tsx   # 헤더 (드롭다운, 시스템 프롬프트 버튼)
│   ├── MessageList.tsx          # 메시지 목록 (자동 스크롤)
│   ├── MessageBubble.tsx        # 개별 메시지 말풍선
│   ├── ChatInput.tsx            # 입력창 (auto-resize, Enter/Shift+Enter)
│   └── SystemPromptModal.tsx    # 시스템 프롬프트 설정 모달
│
├── hooks/
│   ├── useChat.ts               # SSE 스트리밍 상태 관리
│   └── useConversations.ts      # 대화 CRUD 상태 관리
│
├── lib/
│   ├── anthropic.ts             # Anthropic 클라이언트 싱글턴
│   ├── prisma.ts                # Prisma 클라이언트 싱글턴 (adapter-pg)
│   ├── types.ts                 # 공유 TypeScript 타입
│   └── utils.ts                 # cn(), formatDate() 유틸리티
│
├── prisma/
│   └── schema.prisma            # DB 스키마
└── prisma.config.ts             # Prisma 7 설정 파일
```

## 데이터베이스 스키마

```
Conversation
  id           String  (cuid)
  title        String  (기본값: "새 대화", 첫 메시지 후 자동 생성)
  systemPrompt String? (대화별 AI 역할 설정)
  createdAt    DateTime
  updatedAt    DateTime

Message
  id             String  (cuid)
  conversationId String  (→ Conversation, cascade delete)
  role           Role    (USER | ASSISTANT | SYSTEM)
  content        String  (text)
  createdAt      DateTime
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/chat` | 메시지 전송 → SSE 스트리밍 응답 |
| `GET` | `/api/conversations` | 대화 목록 조회 (updatedAt 내림차순) |
| `POST` | `/api/conversations` | 새 대화 생성 |
| `GET` | `/api/conversations/:id` | 대화 + 메시지 전체 조회 |
| `PATCH` | `/api/conversations/:id` | 제목 또는 시스템 프롬프트 수정 |
| `DELETE` | `/api/conversations/:id` | 대화 삭제 (메시지 cascade) |

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 값 입력:

```env
# PostgreSQL — Windows에서 localhost 대신 반드시 127.0.0.1 사용
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/ai_chatbot?schema=public"

# Anthropic Claude API 키 (https://console.anthropic.com)
ANTHROPIC_API_KEY="sk-ant-..."

# NextAuth (현재 미사용, 향후 인증 추가 시 필요)
NEXTAUTH_SECRET="랜덤_문자열"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. PostgreSQL 데이터베이스 실행

Docker가 필요합니다:

```bash
# 최초 실행 시 컨테이너 생성
docker run -d --name chatbot-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ai_chatbot \
  -p 5432:5432 postgres:16-alpine

# 이후 재시작 시
docker start chatbot-postgres
```

### 4. 데이터베이스 스키마 적용

```bash
npm run db:push      # 스키마를 DB에 적용
npm run db:generate  # Prisma 클라이언트 재생성
```

### 5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열어 확인하세요.

## 개발 명령어

```bash
npm run dev          # 개발 서버 실행 (포트 3000)
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버 실행
npm run lint         # ESLint 실행

npm run db:push      # 스키마 변경사항을 DB에 반영 (개발용)
npm run db:migrate   # 마이그레이션 파일 생성 및 적용 (프로덕션용)
npm run db:generate  # Prisma 클라이언트 재생성
npm run db:studio    # Prisma Studio GUI 실행
```

## 아키텍처 메모

- **SSE 스트리밍**: `POST /api/chat`은 `ReadableStream`으로 `data: {...}\n\n` 형식의 SSE를 클라이언트에 전송. 클라이언트의 `useChat` 훅이 TCP 청크 분리에 강건한 버퍼 파싱으로 처리
- **제목 자동 생성**: 첫 메시지 교환 후 백그라운드에서 별도 Claude API 호출로 20자 이내 한국어 제목 생성 (스트리밍 응답 블로킹 없음)
- **Prisma 7**: `prisma.config.ts`에서 DB URL 관리, `PrismaClient`는 `@prisma/adapter-pg` 어댑터 사용
- **날짜 직렬화**: `app/page.tsx` (Server Component)에서 클라이언트로 전달 시 `JSON.parse(JSON.stringify(...))` 로 Date → string 직렬화

## 라이선스

MIT
