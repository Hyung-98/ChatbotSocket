"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var UserConnectionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserConnectionService = void 0;
const common_1 = require("@nestjs/common");
let UserConnectionService = UserConnectionService_1 = class UserConnectionService {
    logger = new common_1.Logger(UserConnectionService_1.name);
    maxConnectionsPerUser = parseInt(process.env.MAX_CONNECTIONS_PER_USER || '5');
    userConnections = new Map();
    socketUsers = new Map();
    socketDevices = new Map();
    addConnection(userId, socket, userAgent) {
        const currentConnections = this.getUserConnectionCount(userId);
        if (currentConnections >= this.maxConnectionsPerUser) {
            this.logger.warn(`User ${userId} exceeded maximum connections (${this.maxConnectionsPerUser})`);
            return false;
        }
        if (!this.userConnections.has(userId)) {
            this.userConnections.set(userId, new Set());
        }
        this.userConnections.get(userId).add(socket.id);
        this.socketUsers.set(socket.id, userId);
        this.socketDevices.set(socket.id, {
            userAgent: userAgent || 'Unknown',
            timestamp: Date.now(),
        });
        this.logger.log(`User ${userId} connected with socket ${socket.id} (${currentConnections + 1}/${this.maxConnectionsPerUser})`);
        return true;
    }
    removeConnection(socket) {
        const userId = this.socketUsers.get(socket.id);
        if (!userId) {
            this.logger.warn(`Socket ${socket.id} not found in user connections`);
            return null;
        }
        this.socketUsers.delete(socket.id);
        this.socketDevices.delete(socket.id);
        const userSockets = this.userConnections.get(userId);
        if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
                this.userConnections.delete(userId);
                this.logger.log(`User ${userId} disconnected (last connection)`);
                return userId;
            }
            else {
                this.logger.log(`User ${userId} disconnected (${userSockets.size} connections remaining)`);
            }
        }
        return null;
    }
    getUserSockets(userId) {
        const sockets = this.userConnections.get(userId);
        return sockets ? Array.from(sockets) : [];
    }
    getUserId(socketId) {
        return this.socketUsers.get(socketId);
    }
    isUserOnline(userId) {
        const sockets = this.userConnections.get(userId);
        return !!sockets && sockets.size > 0;
    }
    getUserConnectionCount(userId) {
        const sockets = this.userConnections.get(userId);
        return sockets ? sockets.size : 0;
    }
    getUserDevices(userId) {
        const socketIds = this.getUserSockets(userId);
        return socketIds
            .map((socketId) => {
            const deviceInfo = this.socketDevices.get(socketId);
            return {
                socketId,
                userAgent: deviceInfo?.userAgent || 'Unknown',
                timestamp: deviceInfo?.timestamp || 0,
            };
        })
            .filter((device) => device.userAgent && device.userAgent !== 'Unknown');
    }
    sendToUser(server, userId, event, data) {
        const socketIds = this.getUserSockets(userId);
        socketIds.forEach((socketId) => {
            server.to(socketId).emit(event, data);
        });
    }
    sendToUserExcept(server, userId, excludeSocketId, event, data) {
        const socketIds = this.getUserSockets(userId);
        socketIds.forEach((socketId) => {
            if (socketId !== excludeSocketId) {
                server.to(socketId).emit(event, data);
            }
        });
    }
    getOnlineUsers() {
        return Array.from(this.userConnections.keys());
    }
    getConnectionStats() {
        const totalUsers = this.userConnections.size;
        const totalConnections = Array.from(this.userConnections.values()).reduce((sum, sockets) => sum + sockets.size, 0);
        return {
            totalUsers,
            totalConnections,
            averageConnectionsPerUser: totalUsers > 0 ? totalConnections / totalUsers : 0,
            maxConnectionsPerUser: this.maxConnectionsPerUser,
        };
    }
    hasReachedMaxConnections(userId) {
        return this.getUserConnectionCount(userId) >= this.maxConnectionsPerUser;
    }
    getMaxConnectionsPerUser() {
        return this.maxConnectionsPerUser;
    }
    getRemainingConnections(userId) {
        return Math.max(0, this.maxConnectionsPerUser - this.getUserConnectionCount(userId));
    }
};
exports.UserConnectionService = UserConnectionService;
exports.UserConnectionService = UserConnectionService = UserConnectionService_1 = __decorate([
    (0, common_1.Injectable)()
], UserConnectionService);
//# sourceMappingURL=user-connection.service.js.map