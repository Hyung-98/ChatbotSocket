import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { UserConnectionService } from './user-connection.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { SendMessageDto, TypingDto } from '../common/dto/message.dto';
import type { UserWithoutPassword } from '../auth/types/user.types';
interface AuthenticatedSocket extends Socket {
    data: {
        user: UserWithoutPassword;
    };
}
export declare class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private authService;
    private jwtService;
    private redisService;
    private llmService;
    private prismaService;
    private embeddingService;
    private userConnectionService;
    private telemetryService;
    server: Server;
    constructor(authService: AuthService, jwtService: JwtService, redisService: RedisService, llmService: LlmService, prismaService: PrismaService, embeddingService: EmbeddingService, userConnectionService: UserConnectionService, telemetryService: TelemetryService);
    afterInit(server: Server): Promise<void>;
    handleConnection(client: AuthenticatedSocket): Promise<void>;
    handleDisconnect(client: AuthenticatedSocket): void;
    private ensureRoomExists;
    handleJoin(client: AuthenticatedSocket, payload: {
        roomId: string;
    }): Promise<{
        event: string;
        data: {
            roomId: string;
            userId: string;
            userName: string;
            message?: undefined;
        };
    } | {
        event: string;
        data: {
            message: string;
            roomId?: undefined;
            userId?: undefined;
            userName?: undefined;
        };
    }>;
    handleLeave(client: AuthenticatedSocket, payload: {
        roomId: string;
    }): {
        event: string;
        data: {
            roomId: string;
            userId: string;
            userName: string;
            message?: undefined;
        };
    } | {
        event: string;
        data: {
            message: string;
            roomId?: undefined;
            userId?: undefined;
            userName?: undefined;
        };
    };
    handleMessage(client: AuthenticatedSocket, payload: SendMessageDto): Promise<{
        event: string;
        data: {
            messageId: string;
            roomId: string;
            text: string;
            message?: undefined;
        };
    } | {
        event: string;
        data: {
            message: string;
            messageId?: undefined;
            roomId?: undefined;
            text?: undefined;
        };
    }>;
    handleTyping(client: AuthenticatedSocket, payload: TypingDto): {
        event: string;
        data: {
            roomId: string;
            isTyping: boolean;
            message?: undefined;
        };
    } | {
        event: string;
        data: {
            message: string;
            roomId?: undefined;
            isTyping?: undefined;
        };
    };
    handleGetRooms(client: AuthenticatedSocket): {
        event: string;
        data: {
            rooms: string[];
            userId: string;
            message?: undefined;
        };
    } | {
        event: string;
        data: {
            message: string;
            rooms?: undefined;
            userId?: undefined;
        };
    };
    private getUserRooms;
    handleSyncRead(client: AuthenticatedSocket, payload: {
        roomId: string;
        messageId: string;
    }): {
        event: string;
        data: {
            roomId: string;
            messageId: string;
            message?: undefined;
        };
    } | {
        event: string;
        data: {
            message: string;
            roomId?: undefined;
            messageId?: undefined;
        };
    };
    handleSyncTyping(client: AuthenticatedSocket, payload: {
        roomId: string;
        isTyping: boolean;
    }): {
        event: string;
        data: {
            roomId: string;
            isTyping: boolean;
            message?: undefined;
        };
    } | {
        event: string;
        data: {
            message: string;
            roomId?: undefined;
            isTyping?: undefined;
        };
    };
    handleGetDevices(client: AuthenticatedSocket): {
        event: string;
        data: {
            devices: {
                socketId: string;
                userAgent: string;
                timestamp: number;
            }[];
            connectionCount: number;
            userId: string;
            message?: undefined;
        };
    } | {
        event: string;
        data: {
            message: string;
            devices?: undefined;
            connectionCount?: undefined;
            userId?: undefined;
        };
    };
    handleGetConnectionStats(client: AuthenticatedSocket): {
        event: string;
        data: {
            stats: {
                totalUsers: number;
                totalConnections: number;
                averageConnectionsPerUser: number;
                maxConnectionsPerUser: number;
            };
            onlineUsers: string[];
            timestamp: string;
            message?: undefined;
        };
    } | {
        event: string;
        data: {
            message: string;
            stats?: undefined;
            onlineUsers?: undefined;
            timestamp?: undefined;
        };
    };
}
export {};
