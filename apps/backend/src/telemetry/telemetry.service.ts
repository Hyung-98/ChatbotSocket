import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, register } from 'prom-client';

@Injectable()
export class TelemetryService {
  private socketConnectionsGauge: Gauge;
  private messageCounter: Counter;
  private llmResponseTimeHistogram: Histogram;
  private llmTokenUsageCounter: Counter;
  private activeRoomsGauge: Gauge;
  private userSessionsGauge: Gauge;
  private errorCounter: Counter;
  private requestDurationHistogram: Histogram;

  constructor() {
    // Initialize custom metrics
    this.socketConnectionsGauge = new Gauge({
      name: 'socket_connections',
      help: 'Number of active socket connections',
      labelNames: ['status'],
    });

    this.messageCounter = new Counter({
      name: 'message_count',
      help: 'Total number of messages processed',
      labelNames: ['role', 'room_id'],
    });

    this.llmResponseTimeHistogram = new Histogram({
      name: 'llm_response_time_seconds',
      help: 'LLM response time in seconds',
      labelNames: ['provider', 'model'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    });

    this.llmTokenUsageCounter = new Counter({
      name: 'llm_token_usage_total',
      help: 'LLM token usage count',
      labelNames: ['type', 'provider', 'model'],
    });

    this.activeRoomsGauge = new Gauge({
      name: 'active_rooms',
      help: 'Number of active chat rooms',
    });

    this.userSessionsGauge = new Gauge({
      name: 'user_sessions',
      help: 'Number of user sessions',
      labelNames: ['status'],
    });

    this.errorCounter = new Counter({
      name: 'error_count_total',
      help: 'Total number of errors',
      labelNames: ['type', 'severity', 'component'],
    });

    this.requestDurationHistogram = new Histogram({
      name: 'request_duration_seconds',
      help: 'Request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    });

    // Register metrics
    register.registerMetric(this.socketConnectionsGauge);
    register.registerMetric(this.messageCounter);
    register.registerMetric(this.llmResponseTimeHistogram);
    register.registerMetric(this.llmTokenUsageCounter);
    register.registerMetric(this.activeRoomsGauge);
    register.registerMetric(this.userSessionsGauge);
    register.registerMetric(this.errorCounter);
    register.registerMetric(this.requestDurationHistogram);
  }

  recordSocketConnection(delta: number): void {
    this.socketConnectionsGauge.inc(delta);
  }

  recordMessage(role: string, roomId?: string): void {
    this.messageCounter.inc({ role, room_id: roomId || 'unknown' });
  }

  recordLlmResponseTime(
    durationMs: number,
    provider?: string,
    model?: string,
  ): void {
    this.llmResponseTimeHistogram.observe(
      { provider: provider || 'unknown', model: model || 'unknown' },
      durationMs / 1000, // 초 단위로 변환
    );
  }

  recordTokenUsage(
    type: 'prompt' | 'completion',
    count: number,
    provider?: string,
    model?: string,
  ): void {
    this.llmTokenUsageCounter.inc(
      { type, provider: provider || 'unknown', model: model || 'unknown' },
      count,
    );
  }

  recordActiveRooms(count: number): void {
    this.activeRoomsGauge.set(count);
  }

  recordUserSessions(
    count: number,
    status: 'active' | 'inactive' = 'active',
  ): void {
    this.userSessionsGauge.set({ status }, count);
  }

  recordError(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    component: string,
  ): void {
    this.errorCounter.inc({ type, severity, component });
  }

  recordRequestDuration(
    method: string,
    route: string,
    statusCode: string,
    durationSeconds: number,
  ): void {
    this.requestDurationHistogram.observe(
      { method, route, status_code: statusCode },
      durationSeconds,
    );
  }
}
