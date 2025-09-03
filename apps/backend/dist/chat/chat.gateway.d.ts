import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import type { UserWithoutPassword } from '../auth/types/user.types';
interface AuthenticatedSocket extends Socket {
    data: {
        user: UserWithoutPassword;
    };
}
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private authService;
    private jwtService;
    server: Server;
    constructor(authService: AuthService, jwtService: JwtService);
    handleConnection(client: AuthenticatedSocket): Promise<void>;
    handleDisconnect(client: AuthenticatedSocket): void;
    handleJoin(client: AuthenticatedSocket, payload: {
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
            message: any;
            roomId?: undefined;
            userId?: undefined;
            userName?: undefined;
        };
    };
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
            message: any;
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
            message: any;
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
            message: any;
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
            message: any;
            rooms?: undefined;
            userId?: undefined;
        };
    };
}
export {};
