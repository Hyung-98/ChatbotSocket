import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.1.0/index.js';
import http from 'k6/http';
import ws from 'k6/ws';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // 10명 사용자로 램프업
    { duration: '1m', target: 10 }, // 1분간 유지
    { duration: '30s', target: 50 }, // 50명으로 증가
    { duration: '1m', target: 50 }, // 1분간 유지
    { duration: '30s', target: 100 }, // 100명으로 증가
    { duration: '1m', target: 100 }, // 1분간 유지
    { duration: '30s', target: 0 }, // 종료
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95%의 요청이 2초 이내
    ws_connecting: ['p(95)<1000'], // 95%의 WebSocket 연결이 1초 이내
    ws_msgs_received: ['rate>0.1'], // 메시지 수신률 10% 이상
  },
};

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket';

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

function createRoom(token) {
  const roomRes = http.post(
    `${BASE_URL}/rooms`,
    JSON.stringify({
      name: `Test Room ${randomString(8)}`,
      description: 'Load test room',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (roomRes.status !== 201) {
    console.error(`Room creation failed: ${roomRes.status} - ${roomRes.body}`);
    return null;
  }

  const response = JSON.parse(roomRes.body);
  return response.id;
}

export default function () {
  // 1. 인증 토큰 획득
  const token = getAuthToken();
  if (!token) {
    return;
  }

  // 2. 룸 생성
  const roomId = createRoom(token);
  if (!roomId) {
    return;
  }

  // 3. WebSocket 연결
  const url = `${WS_URL}&auth=${token}`;

  const res = ws.connect(url, {}, function (socket) {
    let messageCount = 0;
    const maxMessages = 10;

    socket.on('open', () => {
      console.log('WebSocket connected');

      // 룸 조인
      socket.send(JSON.stringify(['join', { roomId }]));
    });

    socket.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed[0] === 'message') {
          messageCount++;
          console.log(`Received message ${messageCount}: ${parsed[1]?.text?.substring(0, 50)}...`);
        }
      } catch (e) {
        // JSON 파싱 실패는 무시
      }
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // 주기적으로 메시지 전송
    const messageInterval = setInterval(() => {
      if (messageCount >= maxMessages) {
        clearInterval(messageInterval);
        socket.close();
        return;
      }

      const message = {
        roomId: roomId,
        text: `Load test message ${messageCount + 1} from ${randomString(8)}`,
      };

      socket.send(JSON.stringify(['send', message]));
      messageCount++;
    }, 2000); // 2초마다 메시지 전송

    // 30초 후 연결 종료
    setTimeout(() => {
      clearInterval(messageInterval);
      socket.close();
    }, 30000);
  });

  // 연결 성공 확인
  check(res, {
    'WebSocket connected successfully': (r) => r && r.status === 101,
    'WebSocket connection time < 1s': (r) => r && r.timings.connecting < 1000,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'loadtest-results.json': JSON.stringify(data, null, 2),
    'loadtest-summary.html': htmlReport(data),
  };
}

function htmlReport(data) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Load Test Results</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .metric { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
          .metric h3 { margin: 0 0 10px 0; color: #333; }
          .metric-value { font-size: 24px; font-weight: bold; color: #007cba; }
        </style>
      </head>
      <body>
        <h1>Load Test Results</h1>
        
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
          <h3>WebSocket Connections</h3>
          <div class="metric-value">${data.metrics.ws_connecting.values.count}</div>
        </div>
        
        <div class="metric">
          <h3>WebSocket Messages Received</h3>
          <div class="metric-value">${data.metrics.ws_msgs_received.values.count}</div>
        </div>
        
        <div class="metric">
          <h3>Error Rate</h3>
          <div class="metric-value">${((data.metrics.checks.values.fails / data.metrics.checks.values.passes) * 100).toFixed(2)}%</div>
        </div>
      </body>
    </html>
  `;
}
