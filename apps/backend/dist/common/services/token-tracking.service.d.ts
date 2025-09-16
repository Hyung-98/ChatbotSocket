import { PrismaService } from '../../prisma/prisma.service';
export interface TokenUsageData {
    userId?: string;
    roomId?: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
    requestId?: string;
}
export declare class TokenTrackingService {
    private prisma;
    private readonly logger;
    private readonly pricing;
    constructor(prisma: PrismaService);
    trackTokenUsage(data: TokenUsageData): Promise<void>;
    calculateCost(provider: string, model: string, promptTokens: number, completionTokens: number): number;
    getTokenUsageStats(options: {
        startDate?: Date;
        endDate?: Date;
        userId?: string;
        roomId?: string;
        provider?: string;
    }): Promise<{
        total: {
            requests: number;
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
            estimatedCost: number;
        };
        byProvider: {
            provider: string;
            requests: number;
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
            estimatedCost: number;
        }[];
        byModel: {
            provider: string;
            model: string;
            requests: number;
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
            estimatedCost: number;
        }[];
        dailyUsage: {
            date: string;
            tokens: number;
            cost: number;
            requests: number;
        }[];
        userUsage: (import("@prisma/client").Prisma.PickEnumerable<import("@prisma/client").Prisma.TokenUsageGroupByOutputType, "userId"[]> & {
            _count: {
                id: number;
            };
            _sum: {
                totalTokens: number | null;
                estimatedCost: number | null;
            };
        })[];
    }>;
    private getDailyUsageStats;
    private getUserUsageStats;
    getCostProjection(days?: number): Promise<{
        projectedDailyCost: number;
        projectedMonthlyCost: number;
        currentDailyAverage: number;
    }>;
}
