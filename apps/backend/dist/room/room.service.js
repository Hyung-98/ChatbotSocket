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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let RoomService = class RoomService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(createRoomDto, _userId) {
        try {
            const room = await this.prisma.room.create({
                data: {
                    name: createRoomDto.name,
                    description: createRoomDto.description,
                },
                include: {
                    _count: {
                        select: {
                            messages: true,
                        },
                    },
                },
            });
            const roomWithCount = room;
            return {
                ...room,
                messageCount: roomWithCount._count?.messages || 0,
            };
        }
        catch {
            throw new common_1.BadRequestException('Failed to create room');
        }
    }
    async findAll(query) {
        const { skip = 0, take = 10, search } = query;
        const where = search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {};
        const [rooms, total] = await Promise.all([
            this.prisma.room.findMany({
                where,
                skip,
                take,
                orderBy: {
                    createdAt: 'desc',
                },
                include: {
                    _count: {
                        select: {
                            messages: true,
                        },
                    },
                },
            }),
            this.prisma.room.count({ where }),
        ]);
        return {
            rooms: rooms.map((room) => {
                const roomWithCount = room;
                return {
                    ...room,
                    messageCount: roomWithCount._count?.messages || 0,
                };
            }),
            total,
            skip,
            take,
        };
    }
    async findOne(id) {
        const room = await this.prisma.room.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        messages: true,
                    },
                },
            },
        });
        if (!room) {
            throw new common_1.NotFoundException(`Room with ID ${id} not found`);
        }
        const roomWithCount = room;
        return {
            ...room,
            messageCount: roomWithCount._count?.messages || 0,
        };
    }
    async update(id, updateRoomDto, _userId) {
        await this.findOne(id);
        const updatedRoom = await this.prisma.room.update({
            where: { id },
            data: updateRoomDto,
            include: {
                _count: {
                    select: {
                        messages: true,
                    },
                },
            },
        });
        const roomWithCount = updatedRoom;
        return {
            ...updatedRoom,
            messageCount: roomWithCount._count?.messages || 0,
        };
    }
    async remove(id, _userId) {
        await this.findOne(id);
        await this.prisma.room.delete({
            where: { id },
        });
        return { message: 'Room deleted successfully' };
    }
    async getMessages(roomId, query) {
        const room = await this.findOne(roomId);
        const { skip = 0, take = 50 } = query;
        const [messages, total] = await Promise.all([
            this.prisma.message.findMany({
                where: {
                    roomId,
                },
                orderBy: {
                    createdAt: 'asc',
                },
                skip,
                take,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            }),
            this.prisma.message.count({
                where: {
                    roomId,
                },
            }),
        ]);
        return {
            messages,
            total,
            skip,
            take,
            room: {
                id: room.id,
                name: room.name,
                description: room.description ?? null,
            },
        };
    }
    async getRecentMessages(roomId, limit = 20) {
        const room = await this.findOne(roomId);
        const messages = await this.prisma.message.findMany({
            where: {
                roomId,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        return {
            messages: messages.reverse(),
            room: {
                id: room.id,
                name: room.name,
                description: room.description ?? null,
            },
        };
    }
    async getRoomStats(roomId) {
        const room = await this.findOne(roomId);
        const [messageCount, userCount, lastMessage] = await Promise.all([
            this.prisma.message.count({
                where: { roomId },
            }),
            this.prisma.message
                .groupBy({
                by: ['userId'],
                where: {
                    roomId,
                    userId: { not: null },
                },
            })
                .then((result) => result.length),
            this.prisma.message.findFirst({
                where: { roomId },
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            name: true,
                        },
                    },
                },
            }),
        ]);
        return {
            room: {
                id: room.id,
                name: room.name,
                description: room.description ?? null,
            },
            stats: {
                messageCount,
                userCount,
                lastMessage: lastMessage
                    ? {
                        content: lastMessage.content,
                        userName: lastMessage.user?.name || 'System',
                        timestamp: lastMessage.createdAt,
                    }
                    : null,
            },
        };
    }
};
exports.RoomService = RoomService;
exports.RoomService = RoomService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RoomService);
//# sourceMappingURL=room.service.js.map