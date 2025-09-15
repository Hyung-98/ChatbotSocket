import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CustomLoggerService } from './logger.service';
export interface SystemMetrics {
    cpu: {
        usage: number;
        loadAverage: number[];
    };
    memory: {
        used: number;
        total: number;
        free: number;
        usage: number;
    };
    database: {
        connected: boolean;
        responseTime: number;
        activeConnections: number;
    };
    redis: {
        connected: boolean;
        responseTime: number;
        memoryUsage: number;
    };
    uptime: number;
    timestamp: Date;
}
export interface PerformanceMetrics {
    responseTime: {
        average: number;
        p95: number;
        p99: number;
    };
    throughput: {
        requestsPerSecond: number;
        messagesPerSecond: number;
    };
    errorRate: {
        percentage: number;
        totalErrors: number;
        totalRequests: number;
    };
}
export declare class MonitoringService {
    private prisma;
    private redis;
    private customLogger;
    private readonly logger;
    private readonly performanceMetrics;
    constructor(prisma: PrismaService, redis: RedisService, customLogger: CustomLoggerService);
    getSystemMetrics(): Promise<SystemMetrics>;
    getPerformanceMetrics(): Promise<PerformanceMetrics>;
    recordPerformanceMetric(responseTime: number, endpoint: string, method: string): void;
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        checks: {
            database: boolean;
            redis: boolean;
            memory: boolean;
            cpu: boolean;
        };
        message: string;
    }>;
    getAlerts(): Promise<Array<{
        id: string;
        level: 'info' | 'warning' | 'error' | 'critical';
        message: string;
        timestamp: Date;
        resolved: boolean;
    }>>;
}
