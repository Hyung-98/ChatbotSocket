import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.1.0/index.js';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // 20명 사용자로 램프업
    { duration: '1m', target: 20 }, // 1분간 유지
    { duration: '30s', target: 50 }, // 50명으로 증가
    { duration: '1m', target: 50 }, // 1분간 유지
    { duration: '30s', target: 100 }, // 100명으로 증가
    { duration: '1m', target: 100 }, // 1분간 유지
    { duration: '30s', target: 0 }, // 종료
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95%의 요청이 1초 이내
    http_req_failed: ['rate<0.1'], // 에러율 10% 미만
    http_reqs: ['rate>10'], // 초당 10개 이상의 요청
  },
};

const BASE_URL = 'http://localhost:3000';

// 테스트용 사용자 계정들
const testUsers = [
  { email: 'test1@example.com', password: 'password123' },
  { email: 'test2@example.com', password: 'password123' },
  { email: 'test3@example.com', password: 'password123' },
  { email: 'test4@example.com', password: 'password123' },
  { email: 'test5@example.com', password: 'password123' },
];

function getAuthToken() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  if (loginRes.status !== 200) {
    console.error(`Login failed: ${loginRes.status} - ${loginRes.body}`);
    return null;
  }

  const response = JSON.parse(loginRes.body);
  return response.accessToken;
}

export default function () {
  const token = getAuthToken();
  if (!token) {
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 1. 사용자 정보 조회
  const profileRes = http.get(`${BASE_URL}/auth/profile`, { headers });
  check(profileRes, {
    'Profile request successful': (r) => r.status === 200,
    'Profile response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(0.5);

  // 2. 룸 목록 조회
  const roomsRes = http.get(`${BASE_URL}/rooms`, { headers });
  check(roomsRes, {
    'Rooms request successful': (r) => r.status === 200,
    'Rooms response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(0.5);

  // 3. 새 룸 생성
  const roomData = {
    name: `Test Room ${randomString(8)}`,
    description: `Load test room created at ${new Date().toISOString()}`,
  };

  const createRoomRes = http.post(`${BASE_URL}/rooms`, JSON.stringify(roomData), { headers });
  check(createRoomRes, {
    'Room creation successful': (r) => r.status === 201,
    'Room creation time < 1000ms': (r) => r.timings.duration < 1000,
  });

  if (createRoomRes.status === 201) {
    const room = JSON.parse(createRoomRes.body);
    const roomId = room.id;

    sleep(0.5);

    // 4. 룸 상세 정보 조회
    const roomDetailRes = http.get(`${BASE_URL}/rooms/${roomId}`, { headers });
    check(roomDetailRes, {
      'Room detail request successful': (r) => r.status === 200,
      'Room detail response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(0.5);

    // 5. 룸 메시지 조회
    const messagesRes = http.get(`${BASE_URL}/rooms/${roomId}/messages?page=1&limit=20`, { headers });
    check(messagesRes, {
      'Messages request successful': (r) => r.status === 200,
      'Messages response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(0.5);

    // 6. 룸 업데이트
    const updateData = {
      name: `Updated Room ${randomString(8)}`,
      description: `Updated at ${new Date().toISOString()}`,
    };

    const updateRes = http.put(`${BASE_URL}/rooms/${roomId}`, JSON.stringify(updateData), { headers });
    check(updateRes, {
      'Room update successful': (r) => r.status === 200,
      'Room update time < 1000ms': (r) => r.timings.duration < 1000,
    });

    sleep(0.5);

    // 7. 룸 삭제
    const deleteRes = http.del(`${BASE_URL}/rooms/${roomId}`, null, { headers });
    check(deleteRes, {
      'Room deletion successful': (r) => r.status === 200,
      'Room deletion time < 1000ms': (r) => r.timings.duration < 1000,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'api-loadtest-results.json': JSON.stringify(data, null, 2),
    'api-loadtest-summary.html': htmlReport(data),
  };
}

function htmlReport(data) {
  const errorRate = ((data.metrics.http_req_failed.values.count / data.metrics.http_reqs.values.count) * 100).toFixed(
    2,
  );

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>API Load Test Results</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .metric { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
          .metric h3 { margin: 0 0 10px 0; color: #333; }
          .metric-value { font-size: 24px; font-weight: bold; color: #007cba; }
          .error { color: #d32f2f; }
          .success { color: #2e7d32; }
        </style>
      </head>
      <body>
        <h1>API Load Test Results</h1>
        
        <div class="metric">
          <h3>Total Requests</h3>
          <div class="metric-value">${data.metrics.http_reqs.values.count}</div>
        </div>
        
        <div class="metric">
          <h3>Average Response Time</h3>
          <div class="metric-value">${data.metrics.http_req_duration.values.avg.toFixed(2)}ms</div>
        </div>
        
        <div class="metric">
          <h3>95th Percentile Response Time</h3>
          <div class="metric-value">${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</div>
        </div>
        
        <div class="metric">
          <h3>Requests per Second</h3>
          <div class="metric-value">${data.metrics.http_reqs.values.rate.toFixed(2)}</div>
        </div>
        
        <div class="metric">
          <h3>Error Rate</h3>
          <div class="metric-value ${errorRate > 5 ? 'error' : 'success'}">${errorRate}%</div>
        </div>
        
        <div class="metric">
          <h3>Successful Checks</h3>
          <div class="metric-value success">${data.metrics.checks.values.passes}</div>
        </div>
        
        <div class="metric">
          <h3>Failed Checks</h3>
          <div class="metric-value error">${data.metrics.checks.values.fails}</div>
        </div>
      </body>
    </html>
  `;
}
