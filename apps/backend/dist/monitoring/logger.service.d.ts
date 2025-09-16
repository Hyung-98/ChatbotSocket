import { LoggerService, LogLevel } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
export interface LogEntry {
    id?: string;
    timestamp: Date;
    level: LogLevel;
    message: string;
    context?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
}
export declare class CustomLoggerService implements LoggerService {
    private prisma;
    private redis;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService);
    log(message: string, context?: string, metadata?: Record<string, unknown>): void;
    error(message: string, trace?: string, context?: string, metadata?: Record<string, unknown>): void;
    warn(message: string, context?: string, metadata?: Record<string, unknown>): void;
    debug(message: string, context?: string, metadata?: Record<string, unknown>): void;
    verbose(message: string, context?: string, metadata?: Record<string, unknown>): void;
    private writeLog;
    getRecentLogs(limit?: number): Promise<LogEntry[]>;
    getErrorLogs(limit?: number): Promise<LogEntry[]>;
    getSystemMetrics(): Promise<{
        totalLogs: number;
        errorLogs: number;
        warningLogs: number;
        recentActivity: LogEntry[];
    }>;
}
