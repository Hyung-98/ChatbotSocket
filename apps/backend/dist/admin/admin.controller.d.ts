import { AdminService, DashboardStats, UserStats, RoomStats, MessageStats } from './admin.service';
import { UserRole } from '@prisma/client';
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: UserRole;
    };
}
export declare class AdminController {
    private adminService;
    constructor(adminService: AdminService);
    getDashboardStats(): Promise<DashboardStats>;
    getUsers(page?: string, limit?: string): Promise<{
        users: UserStats[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getRooms(page?: string, limit?: string): Promise<{
        rooms: RoomStats[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getRecentMessages(limit?: string): Promise<MessageStats[]>;
    getConversationLogs(page?: string, limit?: string, roomId?: string, userId?: string, startDate?: string, endDate?: string, search?: string): Promise<{
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
    getConversationThread(roomId: string, limit?: string): Promise<{
        id: string;
        content: string;
        role: string;
        userName: string | null;
        userEmail: string | null;
        createdAt: Date;
    }[]>;
    createUser(userData: {
        name: string;
        email: string;
        password: string;
        role?: UserRole;
        isActive?: boolean;
    }): Promise<UserStats>;
    updateUserRole(userId: string, role: UserRole, req: AuthenticatedRequest): Promise<UserStats>;
    toggleUserStatus(userId: string): Promise<UserStats>;
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
    deleteUser(userId: string): Promise<{
        message: string;
    }>;
    deleteRoom(roomId: string): Promise<{
        message: string;
    }>;
    getSystemHealth(): Promise<{
        database: boolean;
        redis: boolean;
        uptime: number;
    }>;
    getErrorLogs(page?: string, limit?: string, level?: string, startDate?: string, endDate?: string): Promise<{
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
    getErrorStats(startDate?: string, endDate?: string): Promise<{
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
    getTokenUsage(startDate?: string, endDate?: string): Promise<{
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
    getTokenUsageProjection(): Promise<{
        projectedDailyCost: number;
        projectedMonthlyCost: number;
        currentDailyAverage: number;
    }>;
    getSystemLogs(): {
        logs: {
            timestamp: string;
            level: string;
            message: string;
        }[];
    };
}
export {};
