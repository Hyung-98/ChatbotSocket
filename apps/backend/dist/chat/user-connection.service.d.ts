import { Socket, Server } from 'socket.io';
export declare class UserConnectionService {
    private readonly logger;
    private readonly maxConnectionsPerUser;
    private userConnections;
    private socketUsers;
    private socketDevices;
    addConnection(userId: string, socket: Socket, userAgent?: string): boolean;
    removeConnection(socket: Socket): string | null;
    getUserSockets(userId: string): string[];
    getUserId(socketId: string): string | undefined;
    isUserOnline(userId: string): boolean;
    getUserConnectionCount(userId: string): number;
    getUserDevices(userId: string): Array<{
        socketId: string;
        userAgent: string;
        timestamp: number;
    }>;
    sendToUser(server: Server, userId: string, event: string, data: unknown): void;
    sendToUserExcept(server: Server, userId: string, excludeSocketId: string, event: string, data: unknown): void;
    getOnlineUsers(): string[];
    getConnectionStats(): {
        totalUsers: number;
        totalConnections: number;
        averageConnectionsPerUser: number;
        maxConnectionsPerUser: number;
    };
    hasReachedMaxConnections(userId: string): boolean;
    getMaxConnectionsPerUser(): number;
    getRemainingConnections(userId: string): number;
}
