# 🚀 실시간 WebSocket 기반 AI 챗봇 시스템

Next.js 15와 NestJS를 활용한 실시간 AI 채팅봇 시스템입니다. Anthropic Claude API를 사용하여 지능적인 대화를 제공합니다.

## 🏗️ 프로젝트 구조

```
chatbot-socket/
├── apps/
│   ├── frontend/          # Next.js 15 프론트엔드 (NextAuth v5)
│   │   ├── src/
│   │   │   ├── app/       # App Router (채팅, 인증, 관리자 페이지)
│   │   │   ├── components/ # React 컴포넌트 (테마 토글, 대시보드 등)
│   │   │   ├── hooks/     # 커스텀 훅 (useSocket, useTheme)
│   │   │   └── lib/       # 유틸리티 (NextAuth 설정)
│   │   └── public/        # 정적 파일
│   └── backend/           # NestJS 백엔드
│       ├── src/
│       │   ├── auth/      # JWT 인증 모듈
│       │   ├── chat/      # WebSocket 채팅 게이트웨이
│       │   ├── llm/       # Anthropic Claude API 서비스
│       │   ├── prisma/    # Prisma 서비스
│       │   ├── redis/     # Redis 서비스
│       │   ├── admin/     # 관리자 대시보드 API
│       │   ├── monitoring/ # 모니터링 및 로깅
│       │   └── telemetry/ # 메트릭 수집 (Prometheus)
│       └── prisma/        # Prisma ORM 스키마 및 마이그레이션
├── packages/
│   └── shared/            # 공통 타입 및 유틸리티
├── .taskmaster/           # Task Master AI 설정
├── .github/workflows/     # GitHub Actions CI/CD
├── docker/                # Docker 설정 파일 (Prometheus, Grafana)
├── kubernetes/            # Kubernetes 배포 매니페스트
├── loadtest/              # k6 부하 테스트 스크립트
├── scripts/               # 배포 및 빌드 스크립트
├── package.json           # pnpm 워크스페이스 설정
├── pnpm-workspace.yaml    # pnpm 워크스페이스 정의
├── turbo.json             # Turborepo 설정
├── tsconfig.json          # 루트 TypeScript 설정
├── docker-compose.yml     # 개발 환경 (PostgreSQL, Redis)
├── DEPLOYMENT.md          # 배포 가이드
└── README.md              # 프로젝트 문서
```

## 🚀 시작하기

### 1. 의존성 설치

```bash
# 루트 디렉토리에서 (pnpm 워크스페이스)
pnpm install

# 개별 프로젝트 의존성도 자동으로 설치됩니다
# 프론트엔드: apps/frontend/
# 백엔드: apps/backend/
# 공유 패키지: packages/shared/
```

### 2. 개발 환경 실행

```bash
# Docker 환경 시작 (PostgreSQL, Redis)
docker compose up -d

# 개발 서버 실행 (새 터미널에서)
pnpm dev

# 또는 개별 실행
cd apps/frontend && pnpm dev
cd apps/backend && pnpm start:dev
```

### 3. 빌드

```bash
# 전체 프로젝트 빌드
pnpm build

# 개별 빌드
cd apps/frontend && pnpm build
cd apps/backend && pnpm build
```

## 🔧 개발 도구

- **Turborepo**: 모노레포 관리
- **pnpm**: 빠르고 효율적인 패키지 매니저
- **TypeScript**: 타입 안전성
- **ESLint + Prettier**: 코드 품질 및 포맷팅
- **Docker Compose**: 개발 환경
- **Prisma ORM**: 데이터베이스 ORM
- **PostgreSQL**: 메인 데이터베이스
- **Redis**: 세션 및 Socket.IO 어댑터
- **Socket.IO**: 실시간 WebSocket 통신
- **NextAuth v5**: 인증 시스템
- **Anthropic Claude API**: AI 챗봇 엔진

## 📊 데이터베이스

- **PostgreSQL**: 메인 데이터베이스 (포트: 5432)
  - User, Room, Message 모델
  - 관계형 데이터 저장
- **Redis**: 세션 및 Socket.IO 어댑터 (포트: 6379)
  - 실시간 채팅을 위한 메시지 브로드캐스팅
  - 세션 관리

## 🗄️ 데이터베이스 스키마

### User 모델

- `id`: UUID (기본키)
- `email`: 이메일 (고유값)
- `name`: 사용자 이름
- `createdAt`, `updatedAt`: 타임스탬프
- `messages`: 사용자가 작성한 메시지 (1:N 관계)

### Room 모델

- `id`: UUID (기본키)
- `name`: 채팅방 이름
- `createdAt`, `updatedAt`: 타임스탬프
- `messages`: 채팅방의 메시지들 (1:N 관계)

### Message 모델

- `id`: UUID (기본키)
- `content`: 메시지 내용
- `role`: "user" 또는 "assistant"
- `createdAt`, `updatedAt`: 타임스탬프
- `roomId`: 채팅방 ID (외래키)
- `userId`: 사용자 ID (외래키, 선택적)

## 🌐 접속 정보

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:3001
- **WebSocket**: ws://localhost:3001/chat

## 📝 환경 변수

### 백엔드 환경 변수 (`apps/backend/.env`)

```env
# 데이터베이스
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chatbot?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-jwt-secret"

# Anthropic API
ANTHROPIC_API_KEY="your-anthropic-api-key"

# 프론트엔드 URL
FRONTEND_URL="http://localhost:3000"
```

### 프론트엔드 환경 변수 (`apps/frontend/.env.local`)

```env
# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# API URL
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## 🚀 pnpm 워크스페이스 명령어

```bash
# 워크스페이스 전체에 명령 실행
pnpm --filter "*" build
pnpm --filter "*" lint

# 특정 워크스페이스에만 명령 실행
pnpm --filter @chatbot/shared build
pnpm --filter frontend dev
pnpm --filter backend start:dev
```

## ✨ 주요 기능

### 🔐 인증 시스템

- **NextAuth v5**: 최신 인증 시스템
- **JWT 토큰**: 안전한 세션 관리
- **회원가입/로그인**: 이메일 기반 인증
- **관리자 권한**: RBAC 기반 권한 관리

### 💬 실시간 채팅

- **WebSocket 통신**: Socket.IO 기반 실시간 메시징
- **Redis 어댑터**: 확장 가능한 메시지 브로드캐스팅
- **룸 시스템**: 다중 채팅방 지원
- **자동 스크롤**: 새 메시지 자동 표시
- **멀티 디바이스**: 동일 사용자 다중 디바이스 지원

### 🤖 AI 챗봇

- **Anthropic Claude**: 고성능 AI 모델
- **스트리밍 응답**: 실시간 AI 응답 생성
- **컨텍스트 유지**: 대화 히스토리 기반 응답
- **가독성 개선**: 마크다운 스타일 포맷팅
- **토큰 사용량 추적**: 비용 모니터링

### 🎨 사용자 인터페이스

- **다크/라이트 모드**: 테마 전환 지원
- **반응형 디자인**: 모바일/데스크톱 최적화
- **글래스모피즘**: 현대적인 UI 디자인
- **애니메이션**: 부드러운 전환 효과

### 📊 모니터링 및 관리

- **실시간 메트릭**: Prometheus 기반 모니터링
- **대시보드**: Grafana 시각화
- **부하 테스트**: k6 기반 성능 테스트
- **로그 관리**: 구조화된 로깅 시스템
- **관리자 대시보드**: 사용자 및 시스템 통계

### 🚀 배포 및 확장성

- **Docker 컨테이너화**: 멀티 스테이지 빌드
- **Kubernetes 지원**: 클라우드 네이티브 배포
- **CI/CD 파이프라인**: GitHub Actions 자동화
- **로드 밸런싱**: 고가용성 아키텍처

## 🗄️ 데이터베이스 관리

### Prisma 명령어

```bash
# 백엔드 디렉토리에서
cd apps/backend

# 마이그레이션 생성 및 적용
npx prisma migrate dev --name <migration_name>

# Prisma Client 생성
npx prisma generate

# 데이터베이스 스키마 확인
npx prisma studio

# 마이그레이션 상태 확인
npx prisma migrate status
```

### Docker 데이터베이스 관리

```bash
# PostgreSQL 컨테이너만 시작
docker compose up -d postgres

# 데이터베이스 접속
docker exec -it chatbot-postgres psql -U postgres -d chatbot

# Redis 컨테이너만 시작
docker compose up -d redis
```

## 🚀 pnpm 워크스페이스의 장점

- ⚡ **빠른 설치**: npm보다 2-3배 빠른 의존성 설치
- 💾 **효율적인 저장**: 하드 링크를 통한 디스크 공간 절약
- 🔗 **자동 의존성 해결**: 워크스페이스 간 의존성 자동 관리
- 📋 **일관된 버전**: 모든 프로젝트에서 동일한 패키지 버전 사용

## 🛠️ 개발 명령어

### 코드 품질 관리

```bash
# 전체 프로젝트 린트
pnpm lint

# 린트 자동 수정
pnpm lint:fix

# 코드 포맷팅
pnpm format

# 포맷팅 검사
pnpm format:check
```

### Prisma Studio (시각적 데이터베이스 관리)

```bash
# 백엔드 디렉토리에서
cd apps/backend

# Prisma Studio 실행
npx prisma studio
```

## 🚀 배포 및 모니터링

### Docker Compose 배포

```bash
# 전체 스택 실행
docker-compose up -d

# 모니터링 도구 포함 실행
docker-compose -f docker-compose.monitoring.yml up -d
```

### Kubernetes 배포

```bash
# Linux/Mac
./scripts/deploy.sh

# Windows
scripts\deploy.bat
```

### 부하 테스트

```bash
# API 부하 테스트
k6 run loadtest/api-test.js

# WebSocket 부하 테스트
k6 run loadtest/socket-test.js

# 전체 테스트 실행
./loadtest/run-tests.sh
```

### 모니터링 접속

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **애플리케이션**: http://localhost:3000

자세한 배포 가이드는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참조하세요.

## 📚 기술 스택

### Frontend

- **Next.js 15**: React 프레임워크
- **NextAuth v5**: 인증 시스템
- **Socket.IO Client**: 실시간 통신
- **Tailwind CSS**: 스타일링
- **TypeScript**: 타입 안전성

### Backend

- **NestJS**: Node.js 프레임워크
- **Socket.IO**: WebSocket 서버
- **Prisma**: ORM
- **PostgreSQL**: 데이터베이스
- **Redis**: 캐시 및 메시지 브로커
- **JWT**: 인증 토큰

### AI & External Services

- **Anthropic Claude API**: AI 챗봇 엔진
- **@anthropic-ai/sdk**: 공식 SDK

### 모니터링 & 관찰성

- **Prometheus**: 메트릭 수집
- **Grafana**: 대시보드 및 시각화
- **OpenTelemetry**: 분산 추적
- **Winston**: 구조화된 로깅

### 배포 & 인프라

- **Docker**: 컨테이너화
- **Kubernetes**: 오케스트레이션
- **GitHub Actions**: CI/CD
- **k6**: 부하 테스트
- **Nginx Ingress**: 로드 밸런싱

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.
