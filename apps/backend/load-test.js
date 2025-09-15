const axios = require('axios');
const { performance } = require('perf_hooks');

// 테스트 설정
const CONFIG = {
  BASE_URL: 'http://localhost:3001',
  CONCURRENT_USERS: 50,
  DURATION_SECONDS: 60,
  MESSAGE_INTERVAL_MS: 1000,
  TEST_ROOM_ID: 'load-test-room',
};

// 통계 수집
const stats = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    responseTimes: [],
  },
  messages: {
    sent: 0,
    received: 0,
  },
  errors: [],
  startTime: null,
  endTime: null,
};

// 사용자 시뮬레이션 클래스
class LoadTestUser {
  constructor(userId) {
    this.userId = userId;
    this.email = `loadtest${userId}@example.com`;
    this.password = 'test123!';
    this.accessToken = null;
    this.socket = null;
    this.isConnected = false;
    this.messageCount = 0;
  }

  async register() {
    try {
      const response = await axios.post(`${CONFIG.BASE_URL}/auth/register`, {
        email: this.email,
        name: `Load Test User ${this.userId}`,
        password: this.password,
      });
      return response.data;
    } catch (error) {
      // 이미 존재하는 사용자일 수 있음
      if (error.response?.status === 409) {
        return { message: 'User already exists' };
      }
      throw error;
    }
  }

  async login() {
    try {
      const response = await axios.post(`${CONFIG.BASE_URL}/auth/login`, {
        email: this.email,
        password: this.password,
      });
      this.accessToken = response.data.accessToken;
      return response.data;
    } catch (error) {
      console.error(`User ${this.userId} login failed:`, error.message);
      throw error;
    }
  }

  async createRoom() {
    try {
      const response = await axios.post(
        `${CONFIG.BASE_URL}/rooms`,
        {
          name: CONFIG.TEST_ROOM_ID,
          description: 'Load test room',
        },
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      );
      return response.data;
    } catch (error) {
      // 이미 존재하는 룸일 수 있음
      if (error.response?.status === 409) {
        return { message: 'Room already exists' };
      }
      throw error;
    }
  }

  async sendMessage(content) {
    try {
      const startTime = performance.now();
      const response = await axios.post(
        `${CONFIG.BASE_URL}/rooms/${CONFIG.TEST_ROOM_ID}/messages`,
        {
          content,
          role: 'user',
        },
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      );
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      stats.requests.total++;
      stats.requests.successful++;
      stats.requests.responseTimes.push(responseTime);
      stats.messages.sent++;

      return response.data;
    } catch (error) {
      stats.requests.total++;
      stats.requests.failed++;
      stats.errors.push({
        userId: this.userId,
        error: error.message,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  async runLoadTest() {
    try {
      // 사용자 등록 및 로그인
      await this.register();
      await this.login();
      await this.createRoom();

      // 메시지 전송 루프
      const testDuration = CONFIG.DURATION_SECONDS * 1000;
      const startTime = Date.now();

      while (Date.now() - startTime < testDuration) {
        await this.sendMessage(
          `Load test message ${this.messageCount} from user ${this.userId}`,
        );
        this.messageCount++;
        await new Promise((resolve) =>
          setTimeout(resolve, CONFIG.MESSAGE_INTERVAL_MS),
        );
      }
    } catch (error) {
      console.error(`User ${this.userId} load test failed:`, error.message);
    }
  }
}

// 통계 출력 함수
function printStats() {
  const duration = (stats.endTime - stats.startTime) / 1000;
  const avgResponseTime =
    stats.requests.responseTimes.length > 0
      ? stats.requests.responseTimes.reduce((a, b) => a + b, 0) /
        stats.requests.responseTimes.length
      : 0;

  const sortedResponseTimes = stats.requests.responseTimes.sort(
    (a, b) => a - b,
  );
  const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
  const p99Index = Math.floor(sortedResponseTimes.length * 0.99);
  const p95ResponseTime = sortedResponseTimes[p95Index] || 0;
  const p99ResponseTime = sortedResponseTimes[p99Index] || 0;

  console.log('\n=== 부하 테스트 결과 ===');
  console.log(`테스트 기간: ${duration.toFixed(2)}초`);
  console.log(`동시 사용자 수: ${CONFIG.CONCURRENT_USERS}`);
  console.log(`총 요청 수: ${stats.requests.total}`);
  console.log(`성공한 요청: ${stats.requests.successful}`);
  console.log(`실패한 요청: ${stats.requests.failed}`);
  console.log(
    `성공률: ${((stats.requests.successful / stats.requests.total) * 100).toFixed(2)}%`,
  );
  console.log(`평균 응답 시간: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`P95 응답 시간: ${p95ResponseTime.toFixed(2)}ms`);
  console.log(`P99 응답 시간: ${p99ResponseTime.toFixed(2)}ms`);
  console.log(
    `초당 요청 수: ${(stats.requests.total / duration).toFixed(2)} RPS`,
  );
  console.log(`전송된 메시지 수: ${stats.messages.sent}`);
  console.log(`수신된 메시지 수: ${stats.messages.received}`);
  console.log(`에러 수: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\n=== 에러 목록 ===');
    stats.errors.slice(0, 10).forEach((error, index) => {
      console.log(`${index + 1}. User ${error.userId}: ${error.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`... 및 ${stats.errors.length - 10}개의 추가 에러`);
    }
  }
}

// 메인 부하 테스트 실행
async function runLoadTest() {
  console.log('부하 테스트 시작...');
  console.log(
    `설정: ${CONFIG.CONCURRENT_USERS}명의 사용자, ${CONFIG.DURATION_SECONDS}초간 테스트`,
  );

  stats.startTime = Date.now();

  // 동시 사용자 생성 및 테스트 실행
  const users = [];
  for (let i = 0; i < CONFIG.CONCURRENT_USERS; i++) {
    users.push(new LoadTestUser(i + 1));
  }

  // 모든 사용자의 테스트를 동시에 실행
  const promises = users.map((user) => user.runLoadTest());
  await Promise.all(promises);

  stats.endTime = Date.now();
  printStats();
}

// 스크립트 실행
if (require.main === module) {
  runLoadTest().catch(console.error);
}

module.exports = { LoadTestUser, runLoadTest };
