import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomQueryDto } from './dto/room-query.dto';

interface RoomWithCount {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    messages: number;
  };
}

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  async create(createRoomDto: CreateRoomDto, _userId: string) {
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

      const roomWithCount = room as RoomWithCount;
      return {
        ...room,
        messageCount: roomWithCount._count?.messages || 0,
      };
    } catch {
      throw new BadRequestException('Failed to create room');
    }
  }

  async findAll(query: RoomQueryDto) {
    const { skip = 0, take = 10, search } = query;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
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
        const roomWithCount = room as RoomWithCount;
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

  async findOne(id: string) {
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
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const roomWithCount = room as RoomWithCount;
    return {
      ...room,
      messageCount: roomWithCount._count?.messages || 0,
    };
  }

  async update(id: string, updateRoomDto: UpdateRoomDto, _userId: string) {
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

    const roomWithCount = updatedRoom as RoomWithCount;
    return {
      ...updatedRoom,
      messageCount: roomWithCount._count?.messages || 0,
    };
  }

  async remove(id: string, _userId: string) {
    await this.findOne(id);

    await this.prisma.room.delete({
      where: { id },
    });

    return { message: 'Room deleted successfully' };
  }

  async getMessages(roomId: string, query: { skip?: number; take?: number }) {
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

  async getRecentMessages(roomId: string, limit: number = 20) {
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
      messages: messages.reverse(), // 오래된 것부터 정렬
      room: {
        id: room.id,
        name: room.name,
        description: room.description ?? null,
      },
    };
  }

  async getRoomStats(roomId: string) {
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
}
