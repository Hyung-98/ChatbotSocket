"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const common_1 = require("@nestjs/common");
const prom_client_1 = require("prom-client");
let TelemetryService = class TelemetryService {
    socketConnectionsGauge;
    messageCounter;
    llmResponseTimeHistogram;
    llmTokenUsageCounter;
    activeRoomsGauge;
    userSessionsGauge;
    errorCounter;
    requestDurationHistogram;
    constructor() {
        this.socketConnectionsGauge = new prom_client_1.Gauge({
            name: 'socket_connections',
            help: 'Number of active socket connections',
            labelNames: ['status'],
        });
        this.messageCounter = new prom_client_1.Counter({
            name: 'message_count',
            help: 'Total number of messages processed',
            labelNames: ['role', 'room_id'],
        });
        this.llmResponseTimeHistogram = new prom_client_1.Histogram({
            name: 'llm_response_time_seconds',
            help: 'LLM response time in seconds',
            labelNames: ['provider', 'model'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
        });
        this.llmTokenUsageCounter = new prom_client_1.Counter({
            name: 'llm_token_usage_total',
            help: 'LLM token usage count',
            labelNames: ['type', 'provider', 'model'],
        });
        this.activeRoomsGauge = new prom_client_1.Gauge({
            name: 'active_rooms',
            help: 'Number of active chat rooms',
        });
        this.userSessionsGauge = new prom_client_1.Gauge({
            name: 'user_sessions',
            help: 'Number of user sessions',
            labelNames: ['status'],
        });
        this.errorCounter = new prom_client_1.Counter({
            name: 'error_count_total',
            help: 'Total number of errors',
            labelNames: ['type', 'severity', 'component'],
        });
        this.requestDurationHistogram = new prom_client_1.Histogram({
            name: 'request_duration_seconds',
            help: 'Request duration in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
        });
        prom_client_1.register.registerMetric(this.socketConnectionsGauge);
        prom_client_1.register.registerMetric(this.messageCounter);
        prom_client_1.register.registerMetric(this.llmResponseTimeHistogram);
        prom_client_1.register.registerMetric(this.llmTokenUsageCounter);
        prom_client_1.register.registerMetric(this.activeRoomsGauge);
        prom_client_1.register.registerMetric(this.userSessionsGauge);
        prom_client_1.register.registerMetric(this.errorCounter);
        prom_client_1.register.registerMetric(this.requestDurationHistogram);
    }
    recordSocketConnection(delta) {
        this.socketConnectionsGauge.inc(delta);
    }
    recordMessage(role, roomId) {
        this.messageCounter.inc({ role, room_id: roomId || 'unknown' });
    }
    recordLlmResponseTime(durationMs, provider, model) {
        this.llmResponseTimeHistogram.observe({ provider: provider || 'unknown', model: model || 'unknown' }, durationMs / 1000);
    }
    recordTokenUsage(type, count, provider, model) {
        this.llmTokenUsageCounter.inc({ type, provider: provider || 'unknown', model: model || 'unknown' }, count);
    }
    recordActiveRooms(count) {
        this.activeRoomsGauge.set(count);
    }
    recordUserSessions(count, status = 'active') {
        this.userSessionsGauge.set({ status }, count);
    }
    recordError(type, severity, component) {
        this.errorCounter.inc({ type, severity, component });
    }
    recordRequestDuration(method, route, statusCode, durationSeconds) {
        this.requestDurationHistogram.observe({ method, route, status_code: statusCode }, durationSeconds);
    }
};
exports.TelemetryService = TelemetryService;
exports.TelemetryService = TelemetryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], TelemetryService);
//# sourceMappingURL=telemetry.service.js.map