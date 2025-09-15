import { Counter, Gauge, Histogram } from 'prom-client';

export const socketConnectionsGauge = new Gauge({
  name: 'socket_connections',
  help: 'Number of active socket connections',
  labelNames: ['status'],
});

export const messageCounter = new Counter({
  name: 'message_count',
  help: 'Total number of messages sent',
  labelNames: ['role', 'room_id'],
});

export const llmResponseTimeHistogram = new Histogram({
  name: 'llm_response_time',
  help: 'LLM response time in seconds',
  labelNames: ['provider', 'model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});

export const llmTokenUsageCounter = new Counter({
  name: 'llm_token_usage',
  help: 'Total number of tokens used by LLM',
  labelNames: ['type', 'provider', 'model'],
});

export const activeRoomsGauge = new Gauge({
  name: 'active_rooms',
  help: 'Number of active chat rooms',
});

export const userSessionsGauge = new Gauge({
  name: 'user_sessions',
  help: 'Number of active user sessions',
  labelNames: ['status'],
});

export const errorCounter = new Counter({
  name: 'error_count',
  help: 'Total number of errors',
  labelNames: ['type', 'severity', 'component'],
});

export const requestDurationHistogram = new Histogram({
  name: 'request_duration',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});
