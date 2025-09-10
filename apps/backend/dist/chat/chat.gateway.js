"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const auth_service_1 = require("../auth/auth.service");
const jwt_1 = require("@nestjs/jwt");
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../redis/redis.service");
const llm_service_1 = require("../llm/llm.service");
const prisma_service_1 = require("../prisma/prisma.service");
let ChatGateway = class ChatGateway {
    authService;
    jwtService;
    redisService;
    llmService;
    prismaService;
    server;
    constructor(authService, jwtService, redisService, llmService, prismaService) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.redisService = redisService;
        this.llmService = llmService;
        this.prismaService = prismaService;
        console.log('JWT Secret configured:', !!process.env.JWT_SECRET);
    }
    async afterInit(server) {
        try {
            const pubClient = this.redisService.getClient();
            if (!pubClient) {
                console.error('Redis client is not initialized');
                return;
            }
            await this.redisService.ping();
            const subClient = pubClient.duplicate();
            server.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
            console.log('Redis Adapter initialized for Socket.IO');
        }
        catch (error) {
            console.error('Failed to initialize Redis Adapter:', error);
        }
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token ||
                client.handshake.headers.authorization?.replace('Bearer ', '') ||
                client.handshake.query.token;
            console.log('Socket connection attempt:', {
                hasToken: !!token,
                tokenLength: token?.length,
                auth: client.handshake.auth,
                headers: client.handshake.headers.authorization ? 'present' : 'missing',
                query: client.handshake.query.token ? 'present' : 'missing',
            });
            if (!token) {
                console.log('No token found in handshake');
                client.emit('error', { message: '인증 토큰이 필요합니다.' });
                client.disconnect();
                return;
            }
            let payload;
            try {
                const secret = process.env.JWT_SECRET ||
                    'your-super-secret-jwt-key-change-in-production';
                payload = this.jwtService.verify(token, { secret });
                console.log('JWT payload verified:', {
                    sub: payload.sub,
                    email: payload.email,
                });
            }
            catch (jwtError) {
                console.error('JWT verification failed:', jwtError);
                client.emit('error', { message: '유효하지 않은 토큰입니다.' });
                client.disconnect();
                return;
            }
            const user = await this.authService.validateUser(payload.sub);
            console.log('User validation result:', user ? { id: user.id, name: user.name } : 'null');
            if (!user) {
                console.error('User validation failed for user ID:', payload.sub);
                client.emit('error', { message: '유효하지 않은 사용자입니다.' });
                client.disconnect();
                return;
            }
            client.data.user = user;
            void client.join(`user:${user.id}`);
            console.log(`Client connected: ${user.id} (${user.name})`);
            client.emit('connected', {
                message: '연결되었습니다.',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
            });
        }
        catch (error) {
            console.error('Connection error:', error);
            const errorMessage = error instanceof Error ? error.message : '인증에 실패했습니다.';
            client.emit('error', { message: errorMessage });
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        if (client.data?.user) {
            console.log(`Client disconnected: ${client.data.user.id} (${client.data.user.name})`);
        }
        else {
            console.log(`Client disconnected: ${client.id}`);
        }
    }
    async ensureRoomExists(roomId) {
        try {
            const existingRoom = await this.prismaService.room.findUnique({
                where: { id: roomId },
            });
            if (!existingRoom) {
                await this.prismaService.room.create({
                    data: {
                        id: roomId,
                        name: roomId,
                    },
                });
                console.log(`Room created: ${roomId}`);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Failed to ensure room exists: ${errorMessage}`);
            throw error;
        }
    }
    async handleJoin(client, payload) {
        try {
            const { roomId } = payload;
            const user = client.data.user;
            if (!user) {
                throw new common_1.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            await this.ensureRoomExists(roomId);
            client.rooms.forEach((room) => {
                if (room.startsWith('room:')) {
                    void client.leave(room);
                }
            });
            void client.join(`room:${roomId}`);
            console.log(`User ${user.name} joined room: ${roomId}`);
            client.to(`room:${roomId}`).emit('userJoined', {
                userId: user.id,
                userName: user.name,
                roomId,
                timestamp: new Date().toISOString(),
            });
            return {
                event: 'joined',
                data: { roomId, userId: user.id, userName: user.name },
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : '알 수 없는 오류가 발생했습니다.';
            client.emit('error', { message: errorMessage });
            return { event: 'error', data: { message: errorMessage } };
        }
    }
    handleLeave(client, payload) {
        try {
            const { roomId } = payload;
            const user = client.data.user;
            if (!user) {
                throw new common_1.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            void client.leave(`room:${roomId}`);
            console.log(`User ${user.name} left room: ${roomId}`);
            client.to(`room:${roomId}`).emit('userLeft', {
                userId: user.id,
                userName: user.name,
                roomId,
                timestamp: new Date().toISOString(),
            });
            return {
                event: 'left',
                data: { roomId, userId: user.id, userName: user.name },
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : '알 수 없는 오류가 발생했습니다.';
            client.emit('error', { message: errorMessage });
            return { event: 'error', data: { message: errorMessage } };
        }
    }
    async handleMessage(client, payload) {
        try {
            const { roomId, text } = payload;
            const user = client.data.user;
            if (!user) {
                throw new common_1.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            if (!text || text.trim().length === 0) {
                throw new Error('메시지 내용을 입력해주세요.');
            }
            const trimmedText = text.trim();
            console.log(`Message from ${user.name} in room ${roomId}: ${trimmedText}`);
            await this.llmService.saveMessage(roomId, trimmedText, 'user', user.id);
            const userMessage = {
                id: Math.random().toString(36).substr(2, 9),
                userId: user.id,
                userName: user.name,
                text: trimmedText,
                roomId,
                timestamp: new Date().toISOString(),
            };
            this.server.to(`room:${roomId}`).emit('message', userMessage);
            this.server.to(`room:${roomId}`).emit('stream', { start: true });
            try {
                const messages = await this.llmService.prepareMessages(trimmedText, roomId);
                await this.llmService.generateChatResponse(messages, {
                    onToken: (token) => {
                        this.server.to(`room:${roomId}`).emit('stream', { token });
                    },
                    onComplete: (fullResponse) => {
                        this.llmService
                            .saveMessage(roomId, fullResponse, 'assistant')
                            .catch((error) => {
                            console.error('Failed to save assistant message:', error);
                        });
                        this.server.to(`room:${roomId}`).emit('stream', { end: true });
                    },
                    onError: (error) => {
                        console.error('LLM error:', error);
                        this.server.to(`room:${roomId}`).emit('error', {
                            message: 'AI 응답 생성 중 오류가 발생했습니다.',
                        });
                        this.server.to(`room:${roomId}`).emit('stream', { end: true });
                    },
                });
            }
            catch (llmError) {
                console.error('LLM service error:', llmError);
                this.server.to(`room:${roomId}`).emit('error', {
                    message: 'AI 서비스에 연결할 수 없습니다.',
                });
                this.server.to(`room:${roomId}`).emit('stream', { end: true });
            }
            return {
                event: 'sent',
                data: { messageId: userMessage.id, roomId, text: userMessage.text },
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : '알 수 없는 오류가 발생했습니다.';
            client.emit('error', { message: errorMessage });
            return { event: 'error', data: { message: errorMessage } };
        }
    }
    handleTyping(client, payload) {
        try {
            const { roomId, isTyping } = payload;
            const user = client.data.user;
            if (!user) {
                throw new common_1.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            client.to(`room:${roomId}`).emit('userTyping', {
                userId: user.id,
                userName: user.name,
                roomId,
                isTyping,
                timestamp: new Date().toISOString(),
            });
            return {
                event: 'typing',
                data: { roomId, isTyping },
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : '알 수 없는 오류가 발생했습니다.';
            client.emit('error', { message: errorMessage });
            return { event: 'error', data: { message: errorMessage } };
        }
    }
    handleGetRooms(client) {
        try {
            const user = client.data.user;
            if (!user) {
                throw new common_1.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            const userRooms = Array.from(client.rooms)
                .filter((room) => room.startsWith('room:'))
                .map((room) => room.replace('room:', ''));
            return {
                event: 'rooms',
                data: { rooms: userRooms, userId: user.id },
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : '알 수 없는 오류가 발생했습니다.';
            client.emit('error', { message: errorMessage });
            return { event: 'error', data: { message: errorMessage } };
        }
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleLeave", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('send'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('getRooms'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleGetRooms", null);
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true,
        },
        namespace: '/chat',
    }),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        jwt_1.JwtService,
        redis_service_1.RedisService,
        llm_service_1.LlmService,
        prisma_service_1.PrismaService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map