# 🚀 빠른 시작 가이드

## 1단계: 프로젝트 설정

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
```

## 2단계: 환경 변수 입력

`.env` 파일을 열고 다음 값들을 입력하세요:

```env
# PostgreSQL 데이터베이스 URL
DATABASE_URL="postgresql://username:password@localhost:5432/ai_chatbot"

# Anthropic Claude API 키 (https://console.anthropic.com/ 에서 발급)
ANTHROPIC_API_KEY="sk-ant-..."

# NextAuth 시크릿 (아래 명령어로 생성 가능)
# openssl rand -base64 32
NEXTAUTH_SECRET="랜덤_문자열"
```

## 3단계: 데이터베이스 설정

```bash
# Prisma 클라이언트 생성
npm run db:generate

# 데이터베이스 스키마 적용
npm run db:push
```

## 4단계: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열어보세요! 🎉

## 다음 단계

이제 다음 컴포넌트들을 구현할 차례입니다:

1. **Chat API 엔드포인트** (`app/api/chat/route.ts`)
   - Claude API 스트리밍 응답 구현
   - 메시지 저장 로직

2. **Conversations API** (`app/api/conversations/route.ts`)
   - 대화 목록 조회
   - 대화 생성/삭제

3. **채팅 UI 컴포넌트**
   - ChatInterface
   - MessageList
   - ChatInput
   - ConversationSidebar

4. **Custom Hooks**
   - useChat (채팅 로직)
   - useConversations (대화 관리)

필요한 다음 단계를 알려주시면 계속 구현해드리겠습니다!
