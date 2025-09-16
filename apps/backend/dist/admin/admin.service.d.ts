import { PrismaService } from '../prisma/prisma.service';
import { UserRole, Prisma } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
import { ErrorLoggerService } from '../common/services/error-logger.service';
import { TokenTrackingService } from '../common/services/token-tracking.service';
export interface DashboardStats {
    totalUsers: number;
    activeUsers: number;
    totalRooms: number;
    totalMessages: number;
    onlineUsers: number;
    systemHealth: {
        database: boolean;
        redis: boolean;
        uptime: number;
    };
}
export interface UserStats {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    isActive: boolean;
    lastLogin: Date | null;
    messageCount: number;
    createdAt: Date;
}
export interface RoomStats {
    id: string;
    name: string;
    description: string | null;
    messageCount: number;
    createdAt: Date;
    lastActivity: Date | null;
}
export interface MessageStats {
    id: string;
    content: string;
    role: string;
    userName: string | null;
    roomName: string;
    createdAt: Date;
}
export declare class AdminService {
    private prisma;
    private redis;
    private errorLogger;
    private tokenTracking;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService, errorLogger: ErrorLoggerService, tokenTracking: TokenTrackingService);
    getDashboardStats(): Promise<DashboardStats>;
    getUsers(page?: number, limit?: number): Promise<{
        users: UserStats[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getRooms(page?: number, limit?: number): Promise<{
        rooms: RoomStats[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getRecentMessages(limit?: number): Promise<MessageStats[]>;
    getConversationLogs(options: {
        skip: number;
        take: number;
        roomId?: string;
        userId?: string;
        startDate?: Date;
        endDate?: Date;
        search?: string;
    }): Promise<{
        messages: {
            id: string;
            content: string;
            role: string;
            userName: string | null;
            userEmail: string | null;
            roomName: string;
            roomId: string;
            createdAt: Date;
        }[];
        total: number;
        hasMore: boolean;
    }>;
    getConversationThread(roomId: string, limit?: number): Promise<{
        id: string;
        content: string;
        role: string;
        userName: string | null;
        userEmail: string | null;
        createdAt: Date;
    }[]>;
    updateUserRole(userId: string, role: UserRole, currentUserId?: string): Promise<UserStats>;
    toggleUserStatus(userId: string): Promise<UserStats>;
    deleteUser(userId: string): Promise<void>;
    updateUser(userId: string, updateData: {
        name?: string;
        email?: string;
        role?: UserRole;
        isActive?: boolean;
    }): Promise<UserStats>;
    updateRoom(roomId: string, updateData: {
        name?: string;
        description?: string;
    }): Promise<RoomStats>;
    deleteRoom(roomId: string): Promise<void>;
    private checkSystemHealth;
    createUser(userData: {
        name: string;
        email: string;
        password: string;
        role?: UserRole;
        isActive?: boolean;
    }): Promise<UserStats>;
    getErrorLogs(options: {
        skip: number;
        take: number;
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
    getTokenUsage(options: {
        startDate?: Date;
        endDate?: Date;
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
        userUsage: (Prisma.PickEnumerable<Prisma.TokenUsageGroupByOutputType, "userId"[]> & {
            _count: {
                id: number;
            };
            _sum: {
                totalTokens: number | null;
                estimatedCost: number | null;
            };
        })[];
    }>;
    getTokenUsageProjection(): Promise<{
        projectedDailyCost: number;
        projectedMonthlyCost: number;
        currentDailyAverage: number;
    }>;
}
