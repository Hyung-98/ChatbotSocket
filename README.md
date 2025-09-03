# 🚀 실시간 WebSocket 기반 챗봇 시스템

Next.js 14와 NestJS를 활용한 실시간 채팅봇 시스템입니다.

## 🏗️ 프로젝트 구조

```
chatbot-socket/
├── apps/
│   ├── frontend/          # Next.js 14 프론트엔드
│   └── backend/           # NestJS 백엔드
│       └── prisma/        # Prisma ORM 스키마 및 마이그레이션
├── packages/
│   └── shared/            # 공통 타입 및 유틸리티
├── .taskmaster/           # Task Master AI 설정
├── package.json           # pnpm 워크스페이스 설정
├── pnpm-workspace.yaml    # pnpm 워크스페이스 정의
├── turbo.json             # Turborepo 설정
├── tsconfig.json          # 루트 TypeScript 설정
├── docker-compose.yml     # 개발 환경 (PostgreSQL, Redis, pgAdmin)
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
- **ESLint + Prettier**: 코드 품질
- **Docker Compose**: 개발 환경
- **Prisma ORM**: 데이터베이스 ORM
- **PostgreSQL + pgvector**: 메인 데이터베이스 + 벡터 검색

## 📊 데이터베이스

- **PostgreSQL**: 메인 데이터베이스 (포트: 5432)
  - pgvector 확장 포함 (벡터 검색용)
  - User, Room, Message 모델
  - 관계형 데이터 및 벡터 임베딩 저장
- **Redis**: 세션 및 소켓 어댑터 (포트: 6379)
- **pgAdmin**: 데이터베이스 관리 (포트: 5050)

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
- `role`: "user" 또는 "bot"
- `createdAt`, `updatedAt`: 타임스탬프
- `roomId`: 채팅방 ID (외래키)
- `userId`: 사용자 ID (외래키, 선택적)
- `embedding`: 벡터 임베딩 (pgvector, 1536차원)

## 🌐 접속 정보

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:3001
- **pgAdmin**: http://localhost:5050 (admin@chatbot.com / admin)

## 📝 환경 변수

백엔드 프로젝트(`apps/backend/`)에 `.env` 파일을 생성하여 필요한 환경 변수를 설정하세요:

```env
# 데이터베이스
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chatbot?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-jwt-secret"

# LLM API
OPENAI_API_KEY="your-openai-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"
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

# pgvector 확장 확인
\dx vector
```

🚀 pnpm 워크스페이스의 장점
⚡ 빠른 설치: npm보다 2-3배 빠른 의존성 설치
💾 효율적인 저장: 하드 링크를 통한 디스크 공간 절약
�� 자동 의존성 해결: 워크스페이스 간 의존성 자동 관리
📋 일관된 버전: 모든 프로젝트에서 동일한 패키지 버전 사용

Prisma Studio(시각적 확인)

```bash
# 경로 이동
cd apps/backend

# Prisma Studio 실행
npx prisma studio
```
