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
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const auth_service_1 = require("../auth/auth.service");
const jwt_1 = require("@nestjs/jwt");
const common_2 = require("@nestjs/common");
const redis_service_1 = require("../redis/redis.service");
const llm_service_1 = require("../llm/llm.service");
const prisma_service_1 = require("../prisma/prisma.service");
const embedding_service_1 = require("../embedding/embedding.service");
const user_connection_service_1 = require("./user-connection.service");
const telemetry_service_1 = require("../telemetry/telemetry.service");
const throttle_guard_1 = require("../common/guards/throttle.guard");
const message_dto_1 = require("../common/dto/message.dto");
const sanitizer_util_1 = require("../common/utils/sanitizer.util");
let ChatGateway = class ChatGateway {
    authService;
    jwtService;
    redisService;
    llmService;
    prismaService;
    embeddingService;
    userConnectionService;
    telemetryService;
    server;
    constructor(authService, jwtService, redisService, llmService, prismaService, embeddingService, userConnectionService, telemetryService) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.redisService = redisService;
        this.llmService = llmService;
        this.prismaService = prismaService;
        this.embeddingService = embeddingService;
        this.userConnectionService = userConnectionService;
        this.telemetryService = telemetryService;
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
                const isBlacklisted = await this.authService.isTokenBlacklisted(token);
                if (isBlacklisted) {
                    console.error('Token is blacklisted');
                    client.emit('error', { message: '토큰이 무효화되었습니다.' });
                    client.disconnect();
                    return;
                }
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
            const userAgent = client.handshake.headers['user-agent'];
            const connectionAdded = this.userConnectionService.addConnection(user.id, client, userAgent);
            if (!connectionAdded) {
                console.error(`User ${user.id} exceeded maximum connections`);
                client.emit('error', {
                    message: `최대 연결 수(${this.userConnectionService.getMaxConnectionsPerUser()})를 초과했습니다.`,
                    code: 'MAX_CONNECTIONS_EXCEEDED',
                });
                client.disconnect();
                return;
            }
            void client.join(`user:${user.id}`);
            const userRooms = await this.getUserRooms(user.id);
            userRooms.forEach((roomId) => {
                void client.join(`room:${roomId}`);
            });
            this.telemetryService.recordSocketConnection(1);
            this.telemetryService.recordUserSessions(1, 'active');
            console.log(`Client connected: ${user.id} (${user.name}) - Device: ${userAgent}`);
            client.emit('connected', {
                message: '연결되었습니다.',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
                deviceCount: this.userConnectionService.getUserConnectionCount(user.id),
                maxConnections: this.userConnectionService.getMaxConnectionsPerUser(),
                remainingConnections: this.userConnectionService.getRemainingConnections(user.id),
                autoJoinedRooms: userRooms,
            });
            this.server.emit('user_status', {
                userId: user.id,
                userName: user.name,
                status: 'online',
                deviceCount: this.userConnectionService.getUserConnectionCount(user.id),
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
        const userId = this.userConnectionService.getUserId(client.id);
        if (userId) {
            const wasLastConnection = this.userConnectionService.removeConnection(client);
            this.telemetryService.recordSocketConnection(-1);
            if (wasLastConnection) {
                this.telemetryService.recordUserSessions(-1, 'active');
            }
            console.log(`Client disconnected: ${userId} (${client.data?.user?.name || 'Unknown'})`);
            if (wasLastConnection) {
                this.server.emit('user_status', {
                    userId,
                    userName: client.data?.user?.name || 'Unknown',
                    status: 'offline',
                    deviceCount: 0,
                });
            }
            else {
                this.server.emit('user_status', {
                    userId,
                    userName: client.data?.user?.name || 'Unknown',
                    status: 'online',
                    deviceCount: this.userConnectionService.getUserConnectionCount(userId),
                });
            }
        }
        else {
            console.log(`Client disconnected: ${client.id} (unauthenticated)`);
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
                throw new common_2.UnauthorizedException('인증되지 않은 사용자입니다.');
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
                throw new common_2.UnauthorizedException('인증되지 않은 사용자입니다.');
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
                throw new common_2.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            if (!text || text.trim().length === 0) {
                throw new common_2.BadRequestException('메시지 내용이 비어있습니다.');
            }
            const sanitizedText = sanitizer_util_1.SanitizerUtil.sanitizeMessage(text);
            if (sanitizedText.length === 0) {
                throw new common_2.BadRequestException('유효하지 않은 메시지 내용입니다.');
            }
            const validation = sanitizer_util_1.SanitizerUtil.validateInput(sanitizedText, {
                minLength: 1,
                maxLength: 2000,
                allowSpecialChars: true,
            });
            if (!validation.isValid) {
                throw new common_2.BadRequestException(validation.error);
            }
            const longMessageThreshold = 1500;
            if (sanitizedText.length >= longMessageThreshold) {
                const longMessageGuard = new throttle_guard_1.LongMessageThrottlerGuard(this.redisService);
                const canSendLongMessage = await longMessageGuard.canActivate({
                    switchToWs: () => ({ getClient: () => client }),
                    getHandler: () => ({ name: 'send' }),
                });
                if (!canSendLongMessage) {
                    throw new common_2.BadRequestException('긴 메시지 전송이 너무 빈번합니다. 잠시 후 다시 시도해주세요.');
                }
            }
            if (!roomId || roomId.trim().length === 0) {
                throw new common_2.BadRequestException('룸 ID가 필요합니다.');
            }
            const sanitizedRoomId = sanitizer_util_1.SanitizerUtil.sanitizeForSql(roomId.trim());
            console.log(`Message from ${user.name} in room ${sanitizedRoomId}: ${sanitizedText}`);
            const userMessageId = await this.llmService.saveMessage(sanitizedRoomId, sanitizedText, 'user', user.id);
            this.embeddingService.processEmbeddingsInBackground([
                {
                    id: userMessageId,
                    content: sanitizedText,
                },
            ]);
            const userMessage = {
                id: userMessageId,
                userId: user.id,
                userName: user.name,
                text: sanitizedText,
                roomId: sanitizedRoomId,
                timestamp: new Date().toISOString(),
            };
            this.server.to(`room:${sanitizedRoomId}`).emit('message', userMessage);
            this.telemetryService.recordMessage('user', sanitizedRoomId);
            this.server.to(`room:${sanitizedRoomId}`).emit('stream', { start: true });
            try {
                const messages = await this.llmService.prepareMessages(sanitizedText, sanitizedRoomId);
                await this.llmService.generateChatResponse(messages, {
                    onToken: (token) => {
                        this.server.to(`room:${sanitizedRoomId}`).emit('stream', { token });
                    },
                    onComplete: (fullResponse) => {
                        this.llmService
                            .saveMessage(sanitizedRoomId, fullResponse, 'assistant')
                            .then((assistantMessageId) => {
                            this.embeddingService.processEmbeddingsInBackground([
                                {
                                    id: assistantMessageId,
                                    content: fullResponse,
                                },
                            ]);
                            const aiMessage = {
                                id: assistantMessageId,
                                userId: null,
                                userName: 'AI Assistant',
                                text: fullResponse,
                                roomId: sanitizedRoomId,
                                timestamp: new Date().toISOString(),
                            };
                            this.server
                                .to(`room:${sanitizedRoomId}`)
                                .emit('message', aiMessage);
                            this.telemetryService.recordMessage('assistant', sanitizedRoomId);
                        })
                            .catch((error) => {
                            console.error('Failed to save assistant message:', error);
                        });
                        this.server
                            .to(`room:${sanitizedRoomId}`)
                            .emit('stream', { end: true });
                    },
                    onError: (error) => {
                        console.error('LLM error:', error);
                        const errorMessage = error.message || 'AI 응답 생성 중 오류가 발생했습니다.';
                        this.server.to(`room:${sanitizedRoomId}`).emit('error', {
                            message: errorMessage,
                        });
                        this.server
                            .to(`room:${sanitizedRoomId}`)
                            .emit('stream', { end: true });
                    },
                });
            }
            catch (llmError) {
                console.error('LLM service error:', llmError);
                const errorMessage = llmError instanceof Error
                    ? llmError.message
                    : 'AI 서비스에 연결할 수 없습니다.';
                this.server.to(`room:${sanitizedRoomId}`).emit('error', {
                    message: errorMessage,
                });
                this.server.to(`room:${sanitizedRoomId}`).emit('stream', { end: true });
            }
            return {
                event: 'sent',
                data: {
                    messageId: userMessage.id,
                    roomId: sanitizedRoomId,
                    text: userMessage.text,
                },
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
            const { roomId, status } = payload;
            const user = client.data.user;
            const isTyping = status === 'start';
            if (!user) {
                throw new common_2.UnauthorizedException('인증되지 않은 사용자입니다.');
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
                throw new common_2.UnauthorizedException('인증되지 않은 사용자입니다.');
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
    async getUserRooms(userId) {
        try {
            const rooms = await this.prismaService.room.findMany({
                where: {
                    messages: {
                        some: {
                            userId: userId,
                        },
                    },
                },
                select: {
                    id: true,
                },
            });
            return rooms.map((room) => room.id);
        }
        catch (error) {
            console.error('Failed to get user rooms:', error);
            return [];
        }
    }
    handleSyncRead(client, payload) {
        try {
            const user = client.data.user;
            if (!user) {
                throw new common_2.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            const { roomId, messageId } = payload;
            this.userConnectionService.sendToUserExcept(this.server, user.id, client.id, 'read_receipt', {
                roomId,
                messageId,
                userId: user.id,
                timestamp: new Date().toISOString(),
            });
            return {
                event: 'read_synced',
                data: { roomId, messageId },
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
    handleSyncTyping(client, payload) {
        try {
            const user = client.data.user;
            if (!user) {
                throw new common_2.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            const { roomId, isTyping } = payload;
            this.userConnectionService.sendToUserExcept(this.server, user.id, client.id, 'user_typing_sync', {
                roomId,
                isTyping,
                userId: user.id,
                userName: user.name,
                timestamp: new Date().toISOString(),
            });
            return {
                event: 'typing_synced',
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
    handleGetDevices(client) {
        try {
            const user = client.data.user;
            if (!user) {
                throw new common_2.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            const devices = this.userConnectionService.getUserDevices(user.id);
            const connectionCount = this.userConnectionService.getUserConnectionCount(user.id);
            return {
                event: 'devices',
                data: {
                    devices,
                    connectionCount,
                    userId: user.id,
                },
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
    handleGetConnectionStats(client) {
        try {
            const user = client.data.user;
            if (!user) {
                throw new common_2.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            const stats = this.userConnectionService.getConnectionStats();
            const onlineUsers = this.userConnectionService.getOnlineUsers();
            return {
                event: 'connection_stats',
                data: {
                    stats,
                    onlineUsers,
                    timestamp: new Date().toISOString(),
                },
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
    (0, common_1.UseGuards)(throttle_guard_1.RoomThrottlerGuard),
    (0, websockets_1.SubscribeMessage)('join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleJoin", null);
__decorate([
    (0, common_1.UseGuards)(throttle_guard_1.RoomThrottlerGuard),
    (0, websockets_1.SubscribeMessage)('leave'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleLeave", null);
__decorate([
    (0, common_1.UseGuards)(throttle_guard_1.MessageThrottlerGuard, throttle_guard_1.SpamThrottlerGuard),
    (0, websockets_1.SubscribeMessage)('send'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, message_dto_1.SendMessageDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMessage", null);
__decorate([
    (0, common_1.UseGuards)(throttle_guard_1.TypingThrottlerGuard),
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, message_dto_1.TypingDto]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('getRooms'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleGetRooms", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_read'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleSyncRead", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleSyncTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('get_devices'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleGetDevices", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('get_connection_stats'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleGetConnectionStats", null);
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: [
                process.env.FRONTEND_URL || 'http://localhost:3000',
                'http://localhost:3001',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:3001',
                /^http:\/\/192\.168\.\d+\.\d+:3000$/,
                /^http:\/\/192\.168\.\d+\.\d+:3001$/,
                /^http:\/\/10\.\d+\.\d+\.\d+:3000$/,
                /^http:\/\/10\.\d+\.\d+\.\d+:3001$/,
            ],
            credentials: true,
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        },
        namespace: '/chat',
    }),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        jwt_1.JwtService,
        redis_service_1.RedisService,
        llm_service_1.LlmService,
        prisma_service_1.PrismaService,
        embedding_service_1.EmbeddingService,
        user_connection_service_1.UserConnectionService,
        telemetry_service_1.TelemetryService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map