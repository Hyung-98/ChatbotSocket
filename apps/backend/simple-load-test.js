const axios = require('axios');

// 간단한 부하 테스트
async function simpleLoadTest() {
  const BASE_URL = 'http://localhost:3001';
  const stats = {
    requests: 0,
    successful: 0,
    failed: 0,
    responseTimes: [],
    errors: [],
  };

  console.log('간단한 부하 테스트 시작...');

  // 1. 서버 상태 확인
  try {
    console.log('서버 상태 확인 중...');
    const healthResponse = await axios.get(`${BASE_URL}/`);
    console.log('✅ 서버가 실행 중입니다.');
  } catch (error) {
    console.error('❌ 서버에 연결할 수 없습니다:', error.message);
    return;
  }

  // 2. 사용자 등록 및 로그인
  let accessToken = null;
  try {
    console.log('테스트 사용자 등록 중...');
    await axios.post(`${BASE_URL}/auth/register`, {
      email: 'loadtest@example.com',
      name: 'Load Test User',
      password: 'test123!',
    });
    console.log('✅ 사용자 등록 완료');
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('✅ 사용자가 이미 존재합니다');
    } else {
      console.error('❌ 사용자 등록 실패:', error.message);
    }
  }

  try {
    console.log('로그인 중...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'loadtest@example.com',
      password: 'test123!',
    });
    accessToken = loginResponse.data.accessToken;
    console.log('✅ 로그인 완료');
  } catch (error) {
    console.error('❌ 로그인 실패:', error.message);
    return;
  }

  // 3. 룸 생성
  let roomId = null;
  try {
    console.log('테스트 룸 생성 중...');
    const roomResponse = await axios.post(
      `${BASE_URL}/rooms`,
      {
        name: 'load-test-room',
        description: 'Load test room',
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    roomId = roomResponse.data.id;
    console.log('✅ 룸 생성 완료');
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('✅ 룸이 이미 존재합니다');
      // 기존 룸 ID 가져오기
      const roomsResponse = await axios.get(`${BASE_URL}/rooms`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const room = roomsResponse.data.find((r) => r.name === 'load-test-room');
      if (room) {
        roomId = room.id;
      }
    } else {
      console.error('❌ 룸 생성 실패:', error.message);
      return;
    }
  }

  // 4. 메시지 전송 테스트
  console.log('메시지 전송 테스트 시작...');
  const startTime = Date.now();
  const testDuration = 10000; // 10초
  let messageCount = 0;

  while (Date.now() - startTime < testDuration) {
    try {
      const messageStartTime = Date.now();
      const response = await axios.post(
        `${BASE_URL}/rooms/${roomId}/messages`,
        {
          content: `Load test message ${messageCount + 1}`,
          role: 'user',
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const messageEndTime = Date.now();
      const responseTime = messageEndTime - messageStartTime;

      stats.requests++;
      stats.successful++;
      stats.responseTimes.push(responseTime);
      messageCount++;

      if (messageCount % 10 === 0) {
        console.log(`📤 ${messageCount}개 메시지 전송 완료`);
      }

      // 100ms 대기
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      stats.requests++;
      stats.failed++;
      stats.errors.push({
        message: error.message,
        timestamp: new Date(),
      });
      console.error(`❌ 메시지 전송 실패:`, error.message);
    }
  }

  // 5. 결과 출력
  const duration = (Date.now() - startTime) / 1000;
  const avgResponseTime =
    stats.responseTimes.length > 0
      ? stats.responseTimes.reduce((a, b) => a + b, 0) /
        stats.responseTimes.length
      : 0;

  const sortedResponseTimes = stats.responseTimes.sort((a, b) => a - b);
  const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
  const p99Index = Math.floor(sortedResponseTimes.length * 0.99);
  const p95ResponseTime = sortedResponseTimes[p95Index] || 0;
  const p99ResponseTime = sortedResponseTimes[p99Index] || 0;

  console.log('\n=== 부하 테스트 결과 ===');
  console.log(`테스트 기간: ${duration.toFixed(2)}초`);
  console.log(`총 요청 수: ${stats.requests}`);
  console.log(`성공한 요청: ${stats.successful}`);
  console.log(`실패한 요청: ${stats.failed}`);
  console.log(
    `성공률: ${((stats.successful / stats.requests) * 100).toFixed(2)}%`,
  );
  console.log(`평균 응답 시간: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`P95 응답 시간: ${p95ResponseTime.toFixed(2)}ms`);
  console.log(`P99 응답 시간: ${p99ResponseTime.toFixed(2)}ms`);
  console.log(`초당 요청 수: ${(stats.requests / duration).toFixed(2)} RPS`);
  console.log(`전송된 메시지 수: ${messageCount}`);

  if (stats.errors.length > 0) {
    console.log(`\n에러 수: ${stats.errors.length}`);
    console.log('최근 에러들:');
    stats.errors.slice(0, 5).forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.message}`);
    });
  }

  console.log('\n✅ 부하 테스트 완료!');
}

// 테스트 실행
simpleLoadTest().catch(console.error);
