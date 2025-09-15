import { MonitoringService, SystemMetrics, PerformanceMetrics } from './monitoring.service';
import { CustomLoggerService } from './logger.service';
export declare class MonitoringController {
    private monitoringService;
    private loggerService;
    constructor(monitoringService: MonitoringService, loggerService: CustomLoggerService);
    getSystemMetrics(): Promise<SystemMetrics>;
    getPerformanceMetrics(): Promise<PerformanceMetrics>;
    getHealthStatus(): Promise<{
        status: "healthy" | "degraded" | "unhealthy";
        checks: {
            database: boolean;
            redis: boolean;
            memory: boolean;
            cpu: boolean;
        };
        message: string;
    }>;
    getAlerts(): Promise<{
        id: string;
        level: "info" | "warning" | "error" | "critical";
        message: string;
        timestamp: Date;
        resolved: boolean;
    }[]>;
    getLogs(): Promise<import("./logger.service").LogEntry[]>;
    getErrorLogs(): Promise<import("./logger.service").LogEntry[]>;
    getLogMetrics(): Promise<{
        totalLogs: number;
        errorLogs: number;
        warningLogs: number;
        recentActivity: import("./logger.service").LogEntry[];
    }>;
}
