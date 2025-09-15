"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AdminService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const redis_service_1 = require("../redis/redis.service");
const error_logger_service_1 = require("../common/services/error-logger.service");
const token_tracking_service_1 = require("../common/services/token-tracking.service");
const bcrypt = __importStar(require("bcrypt"));
let AdminService = AdminService_1 = class AdminService {
    prisma;
    redis;
    errorLogger;
    tokenTracking;
    logger = new common_1.Logger(AdminService_1.name);
    constructor(prisma, redis, errorLogger, tokenTracking) {
        this.prisma = prisma;
        this.redis = redis;
        this.errorLogger = errorLogger;
        this.tokenTracking = tokenTracking;
    }
    async getDashboardStats() {
        const [totalUsers, activeUsers, totalRooms, totalMessages] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.count({ where: { isActive: true } }),
            this.prisma.room.count(),
            this.prisma.message.count(),
        ]);
        let onlineUsers = 0;
        try {
            const redisClient = this.redis.getClient();
            if (redisClient) {
                const onlineUsersSet = await redisClient.sMembers('online_users');
                onlineUsers = onlineUsersSet ? onlineUsersSet.length : 0;
            }
        }
        catch (error) {
            this.logger.warn('Redis에서 온라인 사용자 수를 가져올 수 없습니다:', error);
        }
        const systemHealth = await this.checkSystemHealth();
        return {
            totalUsers,
            activeUsers,
            totalRooms,
            totalMessages,
            onlineUsers,
            systemHealth,
        };
    }
    async getUsers(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { messages: true },
                    },
                },
            }),
            this.prisma.user.count(),
        ]);
        const userStats = users.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            messageCount: user._count.messages,
            createdAt: user.createdAt,
        }));
        return {
            users: userStats,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getRooms(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [rooms, total] = await Promise.all([
            this.prisma.room.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { messages: true },
                    },
                    messages: {
                        select: { createdAt: true },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                },
            }),
            this.prisma.room.count(),
        ]);
        const roomStats = rooms.map((room) => ({
            id: room.id,
            name: room.name,
            description: room.description,
            messageCount: room._count.messages,
            createdAt: room.createdAt,
            lastActivity: room.messages[0]?.createdAt || null,
        }));
        return {
            rooms: roomStats,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getRecentMessages(limit = 50) {
        const messages = await this.prisma.message.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: { name: true },
                },
                room: {
                    select: { name: true },
                },
            },
        });
        return messages.map((message) => ({
            id: message.id,
            content: message.content,
            role: message.role,
            userName: message.user?.name || null,
            roomName: message.room.name,
            createdAt: message.createdAt,
        }));
    }
    async getConversationLogs(options) {
        const where = {};
        if (options.roomId) {
            where.roomId = options.roomId;
        }
        if (options.userId) {
            where.userId = options.userId;
        }
        if (options.startDate || options.endDate) {
            where.createdAt = {};
            if (options.startDate) {
                where.createdAt.gte = options.startDate;
            }
            if (options.endDate) {
                where.createdAt.lte = options.endDate;
            }
        }
        if (options.search) {
            where.content = {
                contains: options.search,
                mode: 'insensitive',
            };
        }
        const [messages, total] = await Promise.all([
            this.prisma.message.findMany({
                where,
                skip: options.skip,
                take: options.take,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    room: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            this.prisma.message.count({ where }),
        ]);
        return {
            messages: messages.map((message) => ({
                id: message.id,
                content: message.content,
                role: message.role,
                userName: message.user?.name || null,
                userEmail: message.user?.email || null,
                roomName: message.room.name,
                roomId: message.room.id,
                createdAt: message.createdAt,
            })),
            total,
            hasMore: options.skip + options.take < total,
        };
    }
    async getConversationThread(roomId, limit = 100) {
        const messages = await this.prisma.message.findMany({
            where: { roomId },
            take: limit,
            orderBy: { createdAt: 'asc' },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                room: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        return messages.map((message) => ({
            id: message.id,
            content: message.content,
            role: message.role,
            userName: message.user?.name || null,
            userEmail: message.user?.email || null,
            createdAt: message.createdAt,
        }));
    }
    async updateUserRole(userId, role, currentUserId) {
        try {
            this.logger.log(`사용자 역할 변경 시작: ${userId} -> ${role}`);
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    _count: {
                        select: { messages: true },
                    },
                },
            });
            if (!user) {
                throw new common_1.BadRequestException('사용자를 찾을 수 없습니다.');
            }
            if (currentUserId && currentUserId === userId) {
                this.logger.warn(`사용자가 자신의 권한을 변경하려고 시도: ${userId}`);
                throw new common_1.BadRequestException('자신의 권한은 변경할 수 없습니다.');
            }
            this.logger.log(`사용자 역할 변경: ${user.name} (${user.email}) - ${user.role} -> ${role}`);
            const updatedUser = await this.prisma.user.update({
                where: { id: userId },
                data: { role },
                include: {
                    _count: {
                        select: { messages: true },
                    },
                },
            });
            this.logger.log(`사용자 역할 변경 완료: ${updatedUser.name} (${updatedUser.email}) - ${role}`);
            return {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                role: updatedUser.role,
                isActive: updatedUser.isActive,
                lastLogin: updatedUser.lastLogin,
                messageCount: updatedUser._count.messages,
                createdAt: updatedUser.createdAt,
            };
        }
        catch (error) {
            this.logger.error(`사용자 역할 변경 실패: ${userId}`, error);
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('사용자 역할 변경에 실패했습니다.');
        }
    }
    async toggleUserStatus(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new Error('사용자를 찾을 수 없습니다.');
        }
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { isActive: !user.isActive },
            include: {
                _count: {
                    select: { messages: true },
                },
            },
        });
        return {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            isActive: updatedUser.isActive,
            lastLogin: updatedUser.lastLogin,
            messageCount: updatedUser._count.messages,
            createdAt: updatedUser.createdAt,
        };
    }
    async deleteUser(userId) {
        try {
            this.logger.log(`사용자 삭제 시작: ${userId}`);
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    _count: {
                        select: { messages: true, tokenUsage: true },
                    },
                },
            });
            if (!user) {
                throw new common_1.BadRequestException('사용자를 찾을 수 없습니다.');
            }
            this.logger.log(`삭제할 사용자 정보: ${user.name} (${user.email}), 메시지: ${user._count.messages}개, 토큰 사용량: ${user._count.tokenUsage}개`);
            await this.prisma.$transaction(async (tx) => {
                await tx.message.deleteMany({
                    where: { userId: userId },
                });
                await tx.tokenUsage.deleteMany({
                    where: { userId: userId },
                });
                try {
                    const redisClient = this.redis.getClient();
                    if (redisClient) {
                        await redisClient.sRem('online_users', userId);
                        const userConnections = await redisClient.keys(`user_connections:${userId}:*`);
                        if (userConnections.length > 0) {
                            await redisClient.del(userConnections);
                        }
                    }
                }
                catch (redisError) {
                    this.logger.warn('Redis 정리 중 오류 (무시됨):', redisError);
                }
                await tx.user.delete({
                    where: { id: userId },
                });
            });
            this.logger.log(`사용자 삭제 완료: ${userId}`);
        }
        catch (error) {
            this.logger.error(`사용자 삭제 실패: ${userId}`, error);
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('사용자 삭제에 실패했습니다.');
        }
    }
    async updateUser(userId, updateData) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
            include: {
                _count: {
                    select: { messages: true },
                },
            },
        });
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            messageCount: user._count.messages,
            createdAt: user.createdAt,
        };
    }
    async updateRoom(roomId, updateData) {
        const room = await this.prisma.room.update({
            where: { id: roomId },
            data: updateData,
            include: {
                _count: {
                    select: { messages: true },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });
        return {
            id: room.id,
            name: room.name,
            description: room.description,
            messageCount: room._count.messages,
            createdAt: room.createdAt,
            lastActivity: room.messages[0]?.createdAt || null,
        };
    }
    async deleteRoom(roomId) {
        await this.prisma.room.delete({
            where: { id: roomId },
        });
    }
    async checkSystemHealth() {
        let database = false;
        let redis = false;
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            database = true;
        }
        catch (error) {
            this.logger.error('데이터베이스 연결 실패:', error);
        }
        try {
            const redisClient = this.redis.getClient();
            if (redisClient) {
                await redisClient.ping();
                redis = true;
            }
        }
        catch (error) {
            this.logger.error('Redis 연결 실패:', error);
        }
        return {
            database,
            redis,
            uptime: process.uptime(),
        };
    }
    async createUser(userData) {
        try {
            const existingUser = await this.prisma.user.findUnique({
                where: { email: userData.email },
            });
            if (existingUser) {
                throw new common_1.ConflictException('이미 존재하는 이메일입니다.');
            }
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            const newUser = await this.prisma.user.create({
                data: {
                    name: userData.name,
                    email: userData.email,
                    password: hashedPassword,
                    role: userData.role || client_1.UserRole.USER,
                    isActive: userData.isActive !== undefined ? userData.isActive : true,
                },
                include: {
                    _count: {
                        select: { messages: true },
                    },
                },
            });
            return {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                role: newUser.role,
                isActive: newUser.isActive,
                lastLogin: newUser.lastLogin,
                messageCount: newUser._count.messages,
                createdAt: newUser.createdAt,
            };
        }
        catch (error) {
            this.logger.error('사용자 생성 실패:', error);
            if (error instanceof common_1.ConflictException) {
                throw error;
            }
            throw new common_1.BadRequestException('사용자 생성에 실패했습니다.');
        }
    }
    async getErrorLogs(options) {
        return this.errorLogger.getErrorLogs(options);
    }
    async getErrorStats(options) {
        return this.errorLogger.getErrorStats(options);
    }
    async getTokenUsage(options) {
        return this.tokenTracking.getTokenUsageStats(options);
    }
    async getTokenUsageProjection() {
        return this.tokenTracking.getCostProjection();
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = AdminService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        error_logger_service_1.ErrorLoggerService,
        token_tracking_service_1.TokenTrackingService])
], AdminService);
//# sourceMappingURL=admin.service.js.map