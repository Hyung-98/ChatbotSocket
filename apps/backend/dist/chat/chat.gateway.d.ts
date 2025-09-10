import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
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
    server: Server;
    constructor(authService: AuthService, jwtService: JwtService, redisService: RedisService, llmService: LlmService, prismaService: PrismaService);
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
    handleMessage(client: AuthenticatedSocket, payload: {
        roomId: string;
        text: string;
    }): Promise<{
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
    handleTyping(client: AuthenticatedSocket, payload: {
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
}
export {};
