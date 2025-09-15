"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestDurationHistogram = exports.errorCounter = exports.userSessionsGauge = exports.activeRoomsGauge = exports.llmTokenUsageCounter = exports.llmResponseTimeHistogram = exports.messageCounter = exports.socketConnectionsGauge = void 0;
const prom_client_1 = require("prom-client");
exports.socketConnectionsGauge = new prom_client_1.Gauge({
    name: 'socket_connections',
    help: 'Number of active socket connections',
    labelNames: ['status'],
});
exports.messageCounter = new prom_client_1.Counter({
    name: 'message_count',
    help: 'Total number of messages sent',
    labelNames: ['role', 'room_id'],
});
exports.llmResponseTimeHistogram = new prom_client_1.Histogram({
    name: 'llm_response_time',
    help: 'LLM response time in seconds',
    labelNames: ['provider', 'model'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});
exports.llmTokenUsageCounter = new prom_client_1.Counter({
    name: 'llm_token_usage',
    help: 'Total number of tokens used by LLM',
    labelNames: ['type', 'provider', 'model'],
});
exports.activeRoomsGauge = new prom_client_1.Gauge({
    name: 'active_rooms',
    help: 'Number of active chat rooms',
});
exports.userSessionsGauge = new prom_client_1.Gauge({
    name: 'user_sessions',
    help: 'Number of active user sessions',
    labelNames: ['status'],
});
exports.errorCounter = new prom_client_1.Counter({
    name: 'error_count',
    help: 'Total number of errors',
    labelNames: ['type', 'severity', 'component'],
});
exports.requestDurationHistogram = new prom_client_1.Histogram({
    name: 'request_duration',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});
//# sourceMappingURL=metrics.js.map