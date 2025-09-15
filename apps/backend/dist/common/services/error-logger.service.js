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
var ErrorLoggerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorLoggerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let ErrorLoggerService = ErrorLoggerService_1 = class ErrorLoggerService {
    prisma;
    logger = new common_1.Logger(ErrorLoggerService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async logError(errorData) {
        try {
            await this.prisma.logEntry.create({
                data: {
                    level: errorData.level,
                    message: errorData.message,
                    context: errorData.context || 'application',
                    metadata: errorData.metadata
                        ? JSON.stringify(errorData.metadata)
                        : null,
                },
            });
            const logMessage = `[${errorData.level.toUpperCase()}] ${errorData.message}`;
            const logContext = {
                context: errorData.context,
                userId: errorData.userId,
                roomId: errorData.roomId,
                metadata: errorData.metadata,
            };
            switch (errorData.level) {
                case 'fatal':
                case 'error':
                    this.logger.error(logMessage, errorData.stack, JSON.stringify(logContext));
                    break;
                case 'warn':
                    this.logger.warn(logMessage, JSON.stringify(logContext));
                    break;
                case 'info':
                    this.logger.log(logMessage, JSON.stringify(logContext));
                    break;
                case 'debug':
                    this.logger.debug(logMessage, JSON.stringify(logContext));
                    break;
            }
        }
        catch (dbError) {
            this.logger.error('Failed to save error log to database', dbError);
            this.logger.error(`Original error: ${errorData.message}`, errorData.stack);
        }
    }
    async getErrorLogs(options) {
        const where = {};
        if (options.level) {
            where.level = options.level;
        }
        if (options.startDate || options.endDate) {
            where.timestamp = {};
            if (options.startDate) {
                where.timestamp.gte = options.startDate;
            }
            if (options.endDate) {
                where.timestamp.lte = options.endDate;
            }
        }
        const [logs, total] = await Promise.all([
            this.prisma.logEntry.findMany({
                where,
                skip: options.skip || 0,
                take: options.take || 50,
                orderBy: { timestamp: 'desc' },
            }),
            this.prisma.logEntry.count({ where }),
        ]);
        return {
            logs: logs.map((log) => ({
                ...log,
                metadata: log.metadata ? JSON.parse(log.metadata) : null,
            })),
            total,
            hasMore: (options.skip || 0) + (options.take || 50) < total,
        };
    }
    async getErrorStats(options) {
        const where = {};
        if (options.startDate || options.endDate) {
            where.timestamp = {};
            if (options.startDate) {
                where.timestamp.gte = options.startDate;
            }
            if (options.endDate) {
                where.timestamp.lte = options.endDate;
            }
        }
        const [totalErrors, errorCounts, recentErrors] = await Promise.all([
            this.prisma.logEntry.count({
                where: {
                    ...where,
                    level: { in: ['error', 'fatal'] },
                },
            }),
            this.prisma.logEntry.groupBy({
                by: ['level'],
                where,
                _count: { level: true },
            }),
            this.prisma.logEntry.findMany({
                where: {
                    ...where,
                    level: { in: ['error', 'fatal'] },
                },
                take: 10,
                orderBy: { timestamp: 'desc' },
            }),
        ]);
        return {
            totalErrors,
            errorCounts: errorCounts.reduce((acc, item) => {
                acc[item.level] = item._count.level;
                return acc;
            }, {}),
            recentErrors: recentErrors.map((log) => ({
                ...log,
                metadata: log.metadata ? JSON.parse(log.metadata) : null,
            })),
        };
    }
    async clearOldLogs(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const result = await this.prisma.logEntry.deleteMany({
            where: {
                timestamp: {
                    lt: cutoffDate,
                },
            },
        });
        this.logger.log(`Cleared ${result.count} old log entries older than ${daysToKeep} days`);
    }
};
exports.ErrorLoggerService = ErrorLoggerService;
exports.ErrorLoggerService = ErrorLoggerService = ErrorLoggerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ErrorLoggerService);
//# sourceMappingURL=error-logger.service.js.map