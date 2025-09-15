import { PrismaService } from '../../prisma/prisma.service';
export interface ErrorLogData {
    level: 'error' | 'warn' | 'info' | 'debug' | 'fatal';
    message: string;
    context?: string;
    metadata?: any;
    userId?: string;
    roomId?: string;
    stack?: string;
}
export declare class ErrorLoggerService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    logError(errorData: ErrorLogData): Promise<void>;
    getErrorLogs(options: {
        skip?: number;
        take?: number;
        level?: string;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        logs: {
            metadata: any;
            message: string;
            context: string;
            id: string;
            level: string;
            timestamp: Date;
        }[];
        total: number;
        hasMore: boolean;
    }>;
    getErrorStats(options: {
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        totalErrors: number;
        errorCounts: Record<string, number>;
        recentErrors: {
            metadata: any;
            message: string;
            context: string;
            id: string;
            level: string;
            timestamp: Date;
        }[];
    }>;
    clearOldLogs(daysToKeep?: number): Promise<void>;
}
