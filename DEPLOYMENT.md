# ChatbotSocket 배포 가이드

이 문서는 ChatbotSocket 애플리케이션을 다양한 환경에 배포하는 방법을 설명합니다.

## 📋 목차

- [Docker Compose 배포](#docker-compose-배포)
- [Kubernetes 배포](#kubernetes-배포)
- [부하 테스트](#부하-테스트)
- [모니터링](#모니터링)
- [CI/CD](#cicd)

## 🐳 Docker Compose 배포

### 전제 조건

- Docker
- Docker Compose
- 최소 4GB RAM
- 최소 10GB 디스크 공간

### 배포 단계

1. **환경 변수 설정**

   ```bash
   cp .env.example .env
   # .env 파일을 편집하여 필요한 환경 변수 설정
   ```

2. **애플리케이션 빌드 및 실행**

   ```bash
   # 전체 스택 실행
   docker-compose up -d

   # 로그 확인
   docker-compose logs -f
   ```

3. **애플리케이션 접근**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3000/api
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3001 (admin/admin)

### 서비스 구성

- **Frontend**: Next.js 애플리케이션
- **Backend**: NestJS API 서버
- **PostgreSQL**: 메인 데이터베이스
- **Redis**: 세션 및 캐시 저장소
- **Prometheus**: 메트릭 수집
- **Grafana**: 대시보드 및 시각화

## ☸️ Kubernetes 배포

### 전제 조건

- Kubernetes 클러스터 (v1.20+)
- kubectl 설치 및 구성
- Docker 이미지 레지스트리 접근 권한

### 배포 단계

1. **Docker 이미지 빌드**

   ```bash
   # 백엔드 이미지 빌드
   docker build -t chatbot-backend:latest -f apps/backend/Dockerfile .

   # 프론트엔드 이미지 빌드
   docker build -t chatbot-frontend:latest -f apps/frontend/Dockerfile .
   ```

2. **이미지 푸시 (선택사항)**

   ```bash
   # 레지스트리에 푸시
   docker tag chatbot-backend:latest your-registry/chatbot-backend:latest
   docker tag chatbot-frontend:latest your-registry/chatbot-frontend:latest
   docker push your-registry/chatbot-backend:latest
   docker push your-registry/chatbot-frontend:latest
   ```

3. **Kubernetes 배포**

   ```bash
   # Linux/Mac
   ./scripts/deploy.sh

   # Windows
   scripts\deploy.bat
   ```

4. **배포 확인**
   ```bash
   kubectl get pods -n chatbot
   kubectl get services -n chatbot
   kubectl get ingress -n chatbot
   ```

### Kubernetes 매니페스트

- `kubernetes/namespace.yaml`: 네임스페이스 정의
- `kubernetes/secrets.yaml`: 시크릿 및 환경 변수
- `kubernetes/postgres-deployment.yaml`: PostgreSQL 배포
- `kubernetes/redis-deployment.yaml`: Redis 배포
- `kubernetes/backend-deployment.yaml`: 백엔드 API 배포
- `kubernetes/frontend-deployment.yaml`: 프론트엔드 배포
- `kubernetes/ingress.yaml`: Ingress 설정

## 🧪 부하 테스트

### k6 설치

```bash
# Windows (Chocolatey)
choco install k6

# macOS (Homebrew)
brew install k6

# Linux
sudo apt-get install k6
```

### 테스트 실행

```bash
# API 부하 테스트
k6 run loadtest/api-test.js

# WebSocket 부하 테스트
k6 run loadtest/socket-test.js

# 전체 테스트 실행
# Linux/Mac
./loadtest/run-tests.sh

# Windows
loadtest\run-tests.bat
```

### 테스트 결과

- `loadtest-results.json`: 상세 테스트 결과
- `loadtest-summary.html`: HTML 요약 보고서

## 📊 모니터링

### Prometheus 메트릭

애플리케이션은 다음 메트릭을 제공합니다:

- `socket_connections`: 활성 소켓 연결 수
- `message_count`: 처리된 메시지 수
- `llm_response_time`: LLM 응답 시간
- `llm_token_usage`: LLM 토큰 사용량
- `active_rooms`: 활성 채팅방 수
- `user_sessions`: 사용자 세션 수
- `error_count`: 에러 수
- `request_duration`: HTTP 요청 지속 시간

### Grafana 대시보드

1. Grafana에 접속: http://localhost:3001
2. 로그인: admin/admin
3. Prometheus 데이터소스가 자동으로 구성됨
4. 대시보드에서 실시간 메트릭 확인

## 🔄 CI/CD

### GitHub Actions

프로젝트는 GitHub Actions를 사용하여 자동화된 CI/CD 파이프라인을 제공합니다:

1. **코드 푸시 시 자동 실행**
   - 테스트 실행
   - 린팅 및 타입 체크
   - Docker 이미지 빌드
   - Kubernetes 배포

2. **워크플로우 파일**
   - `.github/workflows/ci.yml`: CI/CD 파이프라인

### 수동 배포

```bash
# Docker Compose
docker-compose up -d

# Kubernetes
kubectl apply -f kubernetes/

# 로그 확인
kubectl logs -f deployment/chatbot-backend -n chatbot
```

## 🚨 문제 해결

### 일반적인 문제

1. **포트 충돌**
   - 3000, 3001, 5432, 6379, 9090 포트가 사용 중인지 확인

2. **메모리 부족**
   - 최소 4GB RAM 필요
   - Docker Desktop 메모리 설정 확인

3. **데이터베이스 연결 실패**
   - PostgreSQL 컨테이너가 실행 중인지 확인
   - 환경 변수 설정 확인

4. **Kubernetes 배포 실패**
   - 클러스터 연결 상태 확인
   - 리소스 제한 확인
   - 이미지 풀 정책 확인

### 로그 확인

```bash
# Docker Compose
docker-compose logs -f [service-name]

# Kubernetes
kubectl logs -f deployment/[deployment-name] -n chatbot
```

### 헬스체크

```bash
# API 헬스체크
curl http://localhost:3000/health

# Kubernetes 헬스체크
kubectl get pods -n chatbot
kubectl describe pod [pod-name] -n chatbot
```

## 📚 추가 리소스

- [Docker 문서](https://docs.docker.com/)
- [Kubernetes 문서](https://kubernetes.io/docs/)
- [k6 문서](https://k6.io/docs/)
- [Prometheus 문서](https://prometheus.io/docs/)
- [Grafana 문서](https://grafana.com/docs/)
