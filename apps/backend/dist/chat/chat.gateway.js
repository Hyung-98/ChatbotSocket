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
const auth_service_1 = require("../auth/auth.service");
const jwt_1 = require("@nestjs/jwt");
const common_1 = require("@nestjs/common");
let ChatGateway = class ChatGateway {
    authService;
    jwtService;
    server;
    constructor(authService, jwtService) {
        this.authService = authService;
        this.jwtService = jwtService;
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth.token ||
                client.handshake.headers.authorization?.replace('Bearer ', '') ||
                client.handshake.query.token;
            if (!token) {
                client.emit('error', { message: '인증 토큰이 필요합니다.' });
                client.disconnect();
                return;
            }
            const payload = this.jwtService.verify(token);
            const user = await this.authService.validateUser(payload.sub);
            if (!user) {
                client.emit('error', { message: '유효하지 않은 토큰입니다.' });
                client.disconnect();
                return;
            }
            client.data.user = user;
            client.join(`user:${user.id}`);
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
            client.emit('error', { message: '인증에 실패했습니다.' });
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
    handleJoin(client, payload) {
        try {
            const { roomId } = payload;
            const user = client.data.user;
            if (!user) {
                throw new common_1.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            client.rooms.forEach((room) => {
                if (room.startsWith('room:')) {
                    client.leave(room);
                }
            });
            client.join(`room:${roomId}`);
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
            client.emit('error', { message: error.message });
            return { event: 'error', data: { message: error.message } };
        }
    }
    handleLeave(client, payload) {
        try {
            const { roomId } = payload;
            const user = client.data.user;
            if (!user) {
                throw new common_1.UnauthorizedException('인증되지 않은 사용자입니다.');
            }
            client.leave(`room:${roomId}`);
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
            client.emit('error', { message: error.message });
            return { event: 'error', data: { message: error.message } };
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
            const message = {
                id: Math.random().toString(36).substr(2, 9),
                userId: user.id,
                userName: user.name,
                text: text.trim(),
                roomId,
                timestamp: new Date().toISOString(),
            };
            console.log(`Message from ${user.name} in room ${roomId}: ${text}`);
            this.server.to(`room:${roomId}`).emit('message', message);
            return {
                event: 'sent',
                data: { messageId: message.id, roomId, text: message.text },
            };
        }
        catch (error) {
            client.emit('error', { message: error.message });
            return { event: 'error', data: { message: error.message } };
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
            client.emit('error', { message: error.message });
            return { event: 'error', data: { message: error.message } };
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
            client.emit('error', { message: error.message });
            return { event: 'error', data: { message: error.message } };
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
    __metadata("design:returntype", void 0)
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
        jwt_1.JwtService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map