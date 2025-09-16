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
var CustomLoggerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomLoggerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
let CustomLoggerService = CustomLoggerService_1 = class CustomLoggerService {
    prisma;
    redis;
    logger = new common_1.Logger(CustomLoggerService_1.name);
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    log(message, context, metadata) {
        void this.writeLog('log', message, context, metadata);
    }
    error(message, trace, context, metadata) {
        void this.writeLog('error', message, context, { ...metadata, trace });
    }
    warn(message, context, metadata) {
        void this.writeLog('warn', message, context, metadata);
    }
    debug(message, context, metadata) {
        void this.writeLog('debug', message, context, metadata);
    }
    verbose(message, context, metadata) {
        void this.writeLog('verbose', message, context, metadata);
    }
    async writeLog(level, message, context, metadata) {
        const logEntry = {
            timestamp: new Date(),
            level,
            message,
            context,
            metadata,
        };
        this.logger[level](message, context);
        try {
            const redisClient = this.redis.getClient();
            if (redisClient) {
                const logKey = 'recent_logs';
                await redisClient.lPush(logKey, JSON.stringify(logEntry));
                await redisClient.lTrim(logKey, 0, 999);
                await redisClient.expire(logKey, 86400);
            }
        }
        catch (error) {
            this.logger.error('Redis 로그 저장 실패:', error);
        }
        if (level === 'error') {
            try {
                await this.prisma.logEntry.create({
                    data: {
                        level,
                        message,
                        context: context || 'Unknown',
                        metadata: metadata ? JSON.stringify(metadata) : null,
                        timestamp: logEntry.timestamp,
                    },
                });
            }
            catch (error) {
                this.logger.error('데이터베이스 로그 저장 실패:', error);
            }
        }
    }
    async getRecentLogs(limit = 100) {
        try {
            const redisClient = this.redis.getClient();
            if (redisClient) {
                const logs = await redisClient.lRange('recent_logs', 0, limit - 1);
                return logs.map((log) => JSON.parse(log)).reverse();
            }
            return [];
        }
        catch (error) {
            this.logger.error('Redis 로그 조회 실패:', error);
            return [];
        }
    }
    async getErrorLogs(limit = 50) {
        try {
            const logs = await this.prisma.logEntry.findMany({
                where: { level: 'error' },
                orderBy: { timestamp: 'desc' },
                take: limit,
            });
            return logs.map((log) => ({
                id: log.id,
                timestamp: log.timestamp,
                level: log.level,
                message: log.message,
                context: log.context,
                metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
            }));
        }
        catch (error) {
            this.logger.error('데이터베이스 에러 로그 조회 실패:', error);
            return [];
        }
    }
    async getSystemMetrics() {
        try {
            const [totalLogs, errorLogs, warningLogs, recentActivity] = await Promise.all([
                this.prisma.logEntry.count(),
                this.prisma.logEntry.count({ where: { level: 'error' } }),
                this.prisma.logEntry.count({ where: { level: 'warn' } }),
                this.getRecentLogs(20),
            ]);
            return {
                totalLogs,
                errorLogs,
                warningLogs,
                recentActivity,
            };
        }
        catch (error) {
            this.logger.error('시스템 메트릭 조회 실패:', error);
            return {
                totalLogs: 0,
                errorLogs: 0,
                warningLogs: 0,
                recentActivity: [],
            };
        }
    }
};
exports.CustomLoggerService = CustomLoggerService;
exports.CustomLoggerService = CustomLoggerService = CustomLoggerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], CustomLoggerService);
//# sourceMappingURL=logger.service.js.map