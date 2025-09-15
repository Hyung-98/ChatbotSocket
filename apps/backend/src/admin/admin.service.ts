import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, Prisma } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
import { ErrorLoggerService } from '../common/services/error-logger.service';
import { TokenTrackingService } from '../common/services/token-tracking.service';
import * as bcrypt from 'bcrypt';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalRooms: number;
  totalMessages: number;
  onlineUsers: number;
  systemHealth: {
    database: boolean;
    redis: boolean;
    uptime: number;
  };
}

export interface UserStats {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: Date | null;
  messageCount: number;
  createdAt: Date;
}

export interface RoomStats {
  id: string;
  name: string;
  description: string | null;
  messageCount: number;
  createdAt: Date;
  lastActivity: Date | null;
}

export interface MessageStats {
  id: string;
  content: string;
  role: string;
  userName: string | null;
  roomName: string;
  createdAt: Date;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private errorLogger: ErrorLoggerService,
    private tokenTracking: TokenTrackingService,
  ) {}

  async getDashboardStats(): Promise<DashboardStats> {
    const [totalUsers, activeUsers, totalRooms, totalMessages] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.room.count(),
        this.prisma.message.count(),
      ]);

    // Redis에서 온라인 사용자 수 가져오기
    let onlineUsers = 0;
    try {
      const redisClient = this.redis.getClient();
      if (redisClient) {
        const onlineUsersSet = await redisClient.sMembers('online_users');
        onlineUsers = onlineUsersSet ? onlineUsersSet.length : 0;
      }
    } catch (error) {
      this.logger.warn(
        'Redis에서 온라인 사용자 수를 가져올 수 없습니다:',
        error,
      );
    }

    // 시스템 상태 확인
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

  async getUsers(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    users: UserStats[];
    total: number;
    page: number;
    totalPages: number;
  }> {
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

    const userStats: UserStats[] = users.map((user) => ({
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

  async getRooms(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    rooms: RoomStats[];
    total: number;
    page: number;
    totalPages: number;
  }> {
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

    const roomStats: RoomStats[] = rooms.map((room) => ({
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

  async getRecentMessages(limit: number = 50): Promise<MessageStats[]> {
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

  async getConversationLogs(options: {
    skip: number;
    take: number;
    roomId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }) {
    const where: Prisma.MessageWhereInput = {};

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

  async getConversationThread(roomId: string, limit: number = 100) {
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

  async updateUserRole(
    userId: string,
    role: UserRole,
    currentUserId?: string,
  ): Promise<UserStats> {
    try {
      this.logger.log(`사용자 역할 변경 시작: ${userId} -> ${role}`);

      // 1. 사용자 존재 여부 확인
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: { messages: true },
          },
        },
      });

      if (!user) {
        throw new BadRequestException('사용자를 찾을 수 없습니다.');
      }

      // 2. 현재 사용자가 자신의 권한을 변경하려는 경우 확인
      if (currentUserId && currentUserId === userId) {
        this.logger.warn(`사용자가 자신의 권한을 변경하려고 시도: ${userId}`);
        throw new BadRequestException('자신의 권한은 변경할 수 없습니다.');
      }

      // 3. 역할 변경 전 로그
      this.logger.log(
        `사용자 역할 변경: ${user.name} (${user.email}) - ${user.role} -> ${role}`,
      );

      // 4. 역할 업데이트
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { role },
        include: {
          _count: {
            select: { messages: true },
          },
        },
      });

      this.logger.log(
        `사용자 역할 변경 완료: ${updatedUser.name} (${updatedUser.email}) - ${role}`,
      );

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
    } catch (error) {
      this.logger.error(`사용자 역할 변경 실패: ${userId}`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('사용자 역할 변경에 실패했습니다.');
    }
  }

  async toggleUserStatus(userId: string): Promise<UserStats> {
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

  async deleteUser(userId: string): Promise<void> {
    try {
      this.logger.log(`사용자 삭제 시작: ${userId}`);

      // 1. 사용자 존재 여부 확인
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: { messages: true, tokenUsage: true },
          },
        },
      });

      if (!user) {
        throw new BadRequestException('사용자를 찾을 수 없습니다.');
      }

      this.logger.log(
        `삭제할 사용자 정보: ${user.name} (${user.email}), 메시지: ${user._count.messages}개, 토큰 사용량: ${user._count.tokenUsage}개`,
      );

      // 2. 관련 데이터 정리 (트랜잭션 사용)
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 2-1. 사용자의 메시지들을 먼저 삭제 (CASCADE가 없으므로 수동 처리)
        await tx.message.deleteMany({
          where: { userId: userId },
        });

        // 2-2. 사용자의 토큰 사용량 기록 삭제
        await tx.tokenUsage.deleteMany({
          where: { userId: userId },
        });

        // 2-3. Redis에서 사용자 연결 정보 정리
        try {
          const redisClient = this.redis.getClient();
          if (redisClient) {
            // 온라인 사용자 목록에서 제거
            await redisClient.sRem('online_users', userId);

            // 사용자별 연결 정보 정리
            const userConnections = await redisClient.keys(
              `user_connections:${userId}:*`,
            );
            if (userConnections.length > 0) {
              await redisClient.del(userConnections as string[]);
            }
          }
        } catch (redisError) {
          this.logger.warn('Redis 정리 중 오류 (무시됨):', redisError);
        }

        // 2-4. 사용자 삭제
        await tx.user.delete({
          where: { id: userId },
        });
      });

      this.logger.log(`사용자 삭제 완료: ${userId}`);
    } catch (error) {
      this.logger.error(`사용자 삭제 실패: ${userId}`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('사용자 삭제에 실패했습니다.');
    }
  }

  async updateUser(
    userId: string,
    updateData: {
      name?: string;
      email?: string;
      role?: UserRole;
      isActive?: boolean;
    },
  ): Promise<UserStats> {
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

  async updateRoom(
    roomId: string,
    updateData: { name?: string; description?: string },
  ): Promise<RoomStats> {
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

  async deleteRoom(roomId: string): Promise<void> {
    await this.prisma.room.delete({
      where: { id: roomId },
    });
  }

  private async checkSystemHealth(): Promise<{
    database: boolean;
    redis: boolean;
    uptime: number;
  }> {
    let database = false;
    let redis = false;

    // 데이터베이스 상태 확인
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch (error) {
      this.logger.error('데이터베이스 연결 실패:', error);
    }

    // Redis 상태 확인
    try {
      const redisClient = this.redis.getClient();
      if (redisClient) {
        await redisClient.ping();
        redis = true;
      }
    } catch (error) {
      this.logger.error('Redis 연결 실패:', error);
    }

    return {
      database,
      redis,
      uptime: process.uptime(),
    };
  }

  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    isActive?: boolean;
  }): Promise<UserStats> {
    try {
      // 이메일 중복 확인
      const existingUser = await this.prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        throw new ConflictException('이미 존재하는 이메일입니다.');
      }

      // 비밀번호 해시화
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // 사용자 생성
      const newUser = await this.prisma.user.create({
        data: {
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
          role: userData.role || UserRole.USER,
          isActive: userData.isActive !== undefined ? userData.isActive : true,
        },
        include: {
          _count: {
            select: { messages: true },
          },
        },
      });

      // UserStats 형태로 변환하여 반환
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
    } catch (error) {
      this.logger.error('사용자 생성 실패:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('사용자 생성에 실패했습니다.');
    }
  }

  async getErrorLogs(options: {
    skip: number;
    take: number;
    level?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    return this.errorLogger.getErrorLogs(options);
  }

  async getErrorStats(options: { startDate?: Date; endDate?: Date }) {
    return this.errorLogger.getErrorStats(options);
  }

  async getTokenUsage(options: { startDate?: Date; endDate?: Date }) {
    return this.tokenTracking.getTokenUsageStats(options);
  }

  async getTokenUsageProjection() {
    return this.tokenTracking.getCostProjection();
  }
}
