# 📄 PRD (Product Requirements Document)

**프로젝트명:** 실시간 WebSocket 기반 챗봇 시스템 구축

------------------------------------------------------------------------

## 1. 개요

-   **목적:**\
    실시간 소켓 통신 기반 챗봇을 구축하여 사용자와 AI가 지연 없이 대화할
    수 있는 환경 제공.\
-   **주요 특징:**
    -   WebSocket(Socket.IO) 기반 양방향 통신\
    -   멀티룸(채팅방) 지원\
    -   스트리밍 응답(LLM 토큰 단위 실시간 전송)\
    -   대화 저장 및 검색\
    -   수평 확장을 고려한 아키텍처 (Redis adapter, 무상태 게이트웨이)

------------------------------------------------------------------------

## 2. 목표

1.  사용자가 로그인 후 실시간 챗봇과 대화 가능\
2.  챗봇 응답은 **스트리밍 방식**으로 실시간 전송\
3.  대화 데이터는 **Postgres**에 저장, 벡터 검색을 통해 맥락 유지\
4.  **멀티 디바이스 동시 접속** 시 메시지 동기화 지원\
5.  안정적인 확장을 위해 **Redis 기반 소켓 어댑터** 적용

------------------------------------------------------------------------

## 3. 주요 기능

### 3.1 사용자 인증/권한

-   JWT 기반 인증 (NextAuth.js + NestJS JWT 검증)
-   소켓 핸드셰이크 시 토큰 확인 → 인증 실패 시 연결 거부

### 3.2 채팅 기능

-   메시지 전송 (클라이언트 → 서버)
-   메시지 브로드캐스트 (서버 → 룸)
-   멀티룸 지원 (`join`, `leave` 이벤트)
-   메시지 영구 저장 (Prisma + Postgres)

### 3.3 챗봇 기능

-   LLM API(OpenAI/Anthropic 등) 연동
-   사용자 발화 입력 → 백엔드에서 큐잉 후 LLM 호출
-   응답은 스트리밍으로 클라이언트에 전달
-   컨텍스트 관리 (최근 N개 메시지 + 벡터 검색 기반 RAG)

### 3.4 관리자 기능(선택)

-   대화 로그 모니터링
-   유저별/방별 메시지 통계
-   에러 로깅/토큰 사용량 추적

------------------------------------------------------------------------

## 4. 기술 스택

### 프론트엔드

-   **Next.js 14(App Router, TS)**
-   Zustand (상태 관리), React Query (데이터 캐싱)
-   socket.io-client
-   SCSS (스타일링)

### 백엔드

-   **NestJS (Gateway, API 모듈 분리)**
-   Socket.IO Gateway
-   REST API (유저 관리, 대화 조회)
-   Prisma ORM + PostgreSQL
-   Redis (세션 공유 + Socket adapter)

### 인프라

-   Docker Compose (개발)
-   Nginx + Docker/K8s (운영)
-   Redis Cluster (확장성)
-   Postgres + pgvector (대화 검색)

------------------------------------------------------------------------

## 5. 아키텍처 다이어그램

     [Next.js] -- socket.io --> [NestJS Gateway] -- Redis Adapter -- [다른 Gateway 인스턴스]
          |                                   |
          | REST API                          | Prisma ORM
          v                                   v
     [User/Chat UI] <-----> [NestJS API] <--> [PostgreSQL + pgvector]
                                   |
                                   v
                                [LLM API]

------------------------------------------------------------------------

## 6. 데이터 모델 (초안)

### User

-   id (UUID)
-   email
-   name
-   createdAt

### Room

-   id (UUID)
-   name
-   createdAt

### Message

-   id (UUID)
-   roomId (FK)
-   userId (FK, optional for bot)
-   role ("user" \| "bot")
-   content (text)
-   createdAt

------------------------------------------------------------------------

## 7. API/소켓 이벤트 설계

### REST API

-   `POST /auth/login` → JWT 발급
-   `GET /rooms/:id/messages` → 메시지 히스토리 조회
-   `POST /rooms` → 새로운 채팅방 생성

### 소켓 이벤트

-   `join { roomId }`
-   `leave { roomId }`
-   `send { roomId, text }`
-   `message { userId, text, ts }`
-   `stream { token }` (LLM 스트리밍 응답)

------------------------------------------------------------------------

## 8. 운영 고려사항

-   **수평 확장:** Socket.IO + Redis adapter 적용
-   **보안:** JWT 인증, 메시지 길이/빈도 제한, Rate limiting
-   **로그/모니터링:** OpenTelemetry + Prometheus + Grafana
-   **테스트:** Vitest(단위), Playwright(E2E)

------------------------------------------------------------------------

## 9. 일정 (예시, 6주 플랜)

1.  주차 1: 환경 세팅(모노레포, Next.js/NestJS, DB, Redis)
2.  주차 2: 인증 + 기본 채팅 기능
3.  주차 3: 챗봇 스트리밍 응답(LLM 연동)
4.  주차 4: 대화 저장/조회, 벡터 검색
5.  주차 5: 관리자 기능 + 모니터링
6.  주차 6: 부하테스트, 배포(K8s/Docker)

------------------------------------------------------------------------

## 10. 성공 지표 (KPI)

-   평균 응답 지연(latency) \< **300ms**
-   1,000 동시 연결 시 안정 동작
-   메시지 손실률 0%
-   평균 서버 가동률 99.9%
