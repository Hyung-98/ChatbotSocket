# Load Testing

이 디렉토리는 ChatbotSocket 애플리케이션의 부하 테스트를 위한 스크립트들을 포함합니다.

## 테스트 스크립트

### 1. API Load Test (`api-test.js`)

- REST API 엔드포인트에 대한 부하 테스트
- 인증, 룸 생성/조회/수정/삭제, 메시지 조회 등 테스트
- 최대 100명의 동시 사용자 시뮬레이션

### 2. WebSocket Load Test (`socket-test.js`)

- WebSocket 연결 및 실시간 메시징 테스트
- 소켓 연결, 룸 조인, 메시지 전송/수신 테스트
- 최대 100명의 동시 WebSocket 연결 시뮬레이션

## 실행 방법

### 전제 조건

1. k6 설치: https://k6.io/docs/getting-started/installation/
2. 백엔드 서버 실행 중 (localhost:3000)
3. 테스트용 사용자 계정 생성

### 실행

```bash
# Linux/Mac
chmod +x run-tests.sh
./run-tests.sh

# Windows
run-tests.bat
```

### 개별 테스트 실행

```bash
# API 테스트만
k6 run api-test.js

# WebSocket 테스트만
k6 run socket-test.js

# 결과를 JSON으로 저장
k6 run --out json=results.json api-test.js
```

## 테스트 결과

테스트 실행 후 다음 파일들이 생성됩니다:

- `results/api-test-{timestamp}.json`: API 테스트 상세 결과
- `results/socket-test-{timestamp}.json`: WebSocket 테스트 상세 결과
- `api-loadtest-summary.html`: API 테스트 HTML 리포트
- `loadtest-summary.html`: WebSocket 테스트 HTML 리포트

## 테스트 시나리오

### API 테스트 시나리오

1. 사용자 인증 (로그인)
2. 프로필 정보 조회
3. 룸 목록 조회
4. 새 룸 생성
5. 룸 상세 정보 조회
6. 룸 메시지 조회
7. 룸 정보 수정
8. 룸 삭제

### WebSocket 테스트 시나리오

1. WebSocket 연결
2. 룸 조인
3. 주기적 메시지 전송 (2초 간격)
4. 메시지 수신 확인
5. 연결 종료

## 성능 기준

### API 테스트

- 95%의 요청이 1초 이내 완료
- 에러율 10% 미만
- 초당 10개 이상의 요청 처리

### WebSocket 테스트

- 95%의 연결이 1초 이내 완료
- 메시지 수신률 10% 이상
- 95%의 요청이 2초 이내 완료

## 커스터마이징

테스트 설정을 수정하려면 각 스크립트의 `options` 객체를 편집하세요:

```javascript
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // 10명 사용자로 램프업
    { duration: '1m', target: 10 }, // 1분간 유지
    { duration: '30s', target: 50 }, // 50명으로 증가
    { duration: '1m', target: 50 }, // 1분간 유지
    { duration: '30s', target: 0 }, // 종료
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95%의 요청이 1초 이내
    http_req_failed: ['rate<0.1'], // 에러율 10% 미만
  },
};
```

## 문제 해결

### 일반적인 문제들

1. **백엔드 서버 연결 실패**
   - 백엔드 서버가 실행 중인지 확인
   - 포트 3000이 사용 가능한지 확인

2. **인증 실패**
   - 테스트용 사용자 계정이 생성되었는지 확인
   - 데이터베이스 연결 상태 확인

3. **WebSocket 연결 실패**
   - 백엔드의 WebSocket 설정 확인
   - 방화벽 설정 확인

### 로그 확인

```bash
# 백엔드 로그
kubectl logs -f deployment/chatbot-backend -n chatbot

# 프론트엔드 로그
kubectl logs -f deployment/chatbot-frontend -n chatbot
```
