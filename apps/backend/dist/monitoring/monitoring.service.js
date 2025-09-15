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
var MonitoringService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const logger_service_1 = require("./logger.service");
let MonitoringService = MonitoringService_1 = class MonitoringService {
    prisma;
    redis;
    customLogger;
    logger = new common_1.Logger(MonitoringService_1.name);
    performanceMetrics = [];
    constructor(prisma, redis, customLogger) {
        this.prisma = prisma;
        this.redis = redis;
        this.customLogger = customLogger;
    }
    async getSystemMetrics() {
        const startTime = Date.now();
        const cpuUsage = process.cpuUsage();
        const loadAverage = require('os').loadavg();
        const memoryUsage = process.memoryUsage();
        const totalMemory = require('os').totalmem();
        const freeMemory = require('os').freemem();
        const dbStartTime = Date.now();
        let dbConnected = false;
        let dbResponseTime = 0;
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            dbConnected = true;
            dbResponseTime = Date.now() - dbStartTime;
        }
        catch (error) {
            this.customLogger.error('데이터베이스 연결 실패', error.stack, 'MonitoringService');
        }
        const redisStartTime = Date.now();
        let redisConnected = false;
        let redisResponseTime = 0;
        let redisMemoryUsage = 0;
        try {
            const redisClient = this.redis.getClient();
            if (redisClient) {
                await redisClient.ping();
                redisConnected = true;
                redisResponseTime = Date.now() - redisStartTime;
                const info = await redisClient.info('memory');
                const memoryMatch = info.match(/used_memory:(\d+)/);
                if (memoryMatch) {
                    redisMemoryUsage = parseInt(memoryMatch[1]);
                }
            }
        }
        catch (error) {
            this.customLogger.error('Redis 연결 실패', error.stack, 'MonitoringService');
        }
        return {
            cpu: {
                usage: (cpuUsage.user + cpuUsage.system) / 1000000,
                loadAverage,
            },
            memory: {
                used: memoryUsage.heapUsed,
                total: totalMemory,
                free: freeMemory,
                usage: (memoryUsage.heapUsed / totalMemory) * 100,
            },
            database: {
                connected: dbConnected,
                responseTime: dbResponseTime,
                activeConnections: 0,
            },
            redis: {
                connected: redisConnected,
                responseTime: redisResponseTime,
                memoryUsage: redisMemoryUsage,
            },
            uptime: process.uptime(),
            timestamp: new Date(),
        };
    }
    async getPerformanceMetrics() {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const recentMetrics = this.performanceMetrics.filter((metric) => metric.timestamp.getTime() > oneHourAgo);
        const responseTimes = recentMetrics.map((m) => m.responseTime);
        const averageResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0;
        const sortedResponseTimes = responseTimes.sort((a, b) => a - b);
        const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
        const p99Index = Math.floor(sortedResponseTimes.length * 0.99);
        const p95ResponseTime = sortedResponseTimes[p95Index] || 0;
        const p99ResponseTime = sortedResponseTimes[p99Index] || 0;
        const requestsPerSecond = recentMetrics.length / 3600;
        const errorLogs = await this.customLogger.getErrorLogs(1000);
        const recentErrors = errorLogs.filter((log) => log.timestamp.getTime() > oneHourAgo);
        const totalErrors = recentErrors.length;
        const totalRequests = recentMetrics.length;
        const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
        return {
            responseTime: {
                average: averageResponseTime,
                p95: p95ResponseTime,
                p99: p99ResponseTime,
            },
            throughput: {
                requestsPerSecond,
                messagesPerSecond: 0,
            },
            errorRate: {
                percentage: errorRate,
                totalErrors,
                totalRequests,
            },
        };
    }
    recordPerformanceMetric(responseTime, endpoint, method) {
        this.performanceMetrics.push({
            timestamp: new Date(),
            responseTime,
            endpoint,
            method,
        });
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const filteredMetrics = this.performanceMetrics.filter((metric) => metric.timestamp.getTime() > oneHourAgo);
        this.performanceMetrics.length = 0;
        this.performanceMetrics.push(...filteredMetrics);
    }
    async getHealthStatus() {
        const metrics = await this.getSystemMetrics();
        const checks = {
            database: metrics.database.connected,
            redis: metrics.redis.connected,
            memory: metrics.memory.usage < 90,
            cpu: metrics.cpu.loadAverage[0] < 4,
        };
        const healthyChecks = Object.values(checks).filter(Boolean).length;
        const totalChecks = Object.keys(checks).length;
        let status;
        let message;
        if (healthyChecks === totalChecks) {
            status = 'healthy';
            message = '모든 시스템이 정상 작동 중입니다.';
        }
        else if (healthyChecks >= totalChecks * 0.5) {
            status = 'degraded';
            message = '일부 시스템에 문제가 있습니다.';
        }
        else {
            status = 'unhealthy';
            message = '시스템에 심각한 문제가 있습니다.';
        }
        return { status, checks, message };
    }
    async getAlerts() {
        const alerts = [];
        const metrics = await this.getSystemMetrics();
        if (metrics.memory.usage > 80) {
            alerts.push({
                id: 'memory-high',
                level: metrics.memory.usage > 95 ? 'critical' : 'warning',
                message: `메모리 사용률이 ${metrics.memory.usage.toFixed(1)}%입니다.`,
                timestamp: new Date(),
                resolved: false,
            });
        }
        if (metrics.cpu.loadAverage[0] > 2) {
            alerts.push({
                id: 'cpu-high',
                level: metrics.cpu.loadAverage[0] > 4 ? 'critical' : 'warning',
                message: `CPU 로드가 ${metrics.cpu.loadAverage[0].toFixed(2)}입니다.`,
                timestamp: new Date(),
                resolved: false,
            });
        }
        if (!metrics.database.connected) {
            alerts.push({
                id: 'database-down',
                level: 'critical',
                message: '데이터베이스 연결이 실패했습니다.',
                timestamp: new Date(),
                resolved: false,
            });
        }
        if (!metrics.redis.connected) {
            alerts.push({
                id: 'redis-down',
                level: 'critical',
                message: 'Redis 연결이 실패했습니다.',
                timestamp: new Date(),
                resolved: false,
            });
        }
        return alerts;
    }
};
exports.MonitoringService = MonitoringService;
exports.MonitoringService = MonitoringService = MonitoringService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        logger_service_1.CustomLoggerService])
], MonitoringService);
//# sourceMappingURL=monitoring.service.js.map