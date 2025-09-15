import { Injectable, Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';

@Injectable()
export class UserConnectionService {
  private readonly logger = new Logger(UserConnectionService.name);
  private readonly maxConnectionsPerUser = parseInt(
    process.env.MAX_CONNECTIONS_PER_USER || '5',
  );

  // userId -> Set<socketId>
  private userConnections: Map<string, Set<string>> = new Map();
  // socketId -> userId
  private socketUsers: Map<string, string> = new Map();
  // socketId -> deviceInfo
  private socketDevices: Map<string, { userAgent: string; timestamp: number }> =
    new Map();

  /**
   * 사용자 연결 추가
   */
  addConnection(userId: string, socket: Socket, userAgent?: string): boolean {
    const currentConnections = this.getUserConnectionCount(userId);

    if (currentConnections >= this.maxConnectionsPerUser) {
      this.logger.warn(
        `User ${userId} exceeded maximum connections (${this.maxConnectionsPerUser})`,
      );
      return false;
    }

    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }

    this.userConnections.get(userId)!.add(socket.id);
    this.socketUsers.set(socket.id, userId);

    // 디바이스 정보 저장
    this.socketDevices.set(socket.id, {
      userAgent: userAgent || 'Unknown',
      timestamp: Date.now(),
    });

    this.logger.log(
      `User ${userId} connected with socket ${socket.id} (${currentConnections + 1}/${this.maxConnectionsPerUser})`,
    );
    return true;
  }

  /**
   * 사용자 연결 제거
   */
  removeConnection(socket: Socket): string | null {
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
        return userId; // 마지막 연결이 끊어진 사용자 ID 반환
      } else {
        this.logger.log(
          `User ${userId} disconnected (${userSockets.size} connections remaining)`,
        );
      }
    }

    return null;
  }

  /**
   * 사용자의 모든 소켓 ID 조회
   */
  getUserSockets(userId: string): string[] {
    const sockets = this.userConnections.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * 소켓 ID로 사용자 ID 조회
   */
  getUserId(socketId: string): string | undefined {
    return this.socketUsers.get(socketId);
  }

  /**
   * 사용자가 온라인인지 확인
   */
  isUserOnline(userId: string): boolean {
    const sockets = this.userConnections.get(userId);
    return !!sockets && sockets.size > 0;
  }

  /**
   * 사용자의 연결 수 조회
   */
  getUserConnectionCount(userId: string): number {
    const sockets = this.userConnections.get(userId);
    return sockets ? sockets.size : 0;
  }

  /**
   * 사용자의 디바이스 정보 조회
   */
  getUserDevices(
    userId: string,
  ): Array<{ socketId: string; userAgent: string; timestamp: number }> {
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

  /**
   * 특정 사용자에게 메시지 전송 (모든 디바이스)
   */
  sendToUser(
    server: Server,
    userId: string,
    event: string,
    data: unknown,
  ): void {
    const socketIds = this.getUserSockets(userId);
    socketIds.forEach((socketId) => {
      server.to(socketId).emit(event, data);
    });
  }

  /**
   * 특정 사용자의 특정 소켓 제외하고 메시지 전송
   */
  sendToUserExcept(
    server: Server,
    userId: string,
    excludeSocketId: string,
    event: string,
    data: unknown,
  ): void {
    const socketIds = this.getUserSockets(userId);
    socketIds.forEach((socketId) => {
      if (socketId !== excludeSocketId) {
        server.to(socketId).emit(event, data);
      }
    });
  }

  /**
   * 모든 온라인 사용자 조회
   */
  getOnlineUsers(): string[] {
    return Array.from(this.userConnections.keys());
  }

  /**
   * 연결 통계 조회
   */
  getConnectionStats(): {
    totalUsers: number;
    totalConnections: number;
    averageConnectionsPerUser: number;
    maxConnectionsPerUser: number;
  } {
    const totalUsers = this.userConnections.size;
    const totalConnections = Array.from(this.userConnections.values()).reduce(
      (sum, sockets) => sum + sockets.size,
      0,
    );

    return {
      totalUsers,
      totalConnections,
      averageConnectionsPerUser:
        totalUsers > 0 ? totalConnections / totalUsers : 0,
      maxConnectionsPerUser: this.maxConnectionsPerUser,
    };
  }

  /**
   * 사용자가 최대 연결 수에 도달했는지 확인
   */
  hasReachedMaxConnections(userId: string): boolean {
    return this.getUserConnectionCount(userId) >= this.maxConnectionsPerUser;
  }

  /**
   * 최대 연결 수 조회
   */
  getMaxConnectionsPerUser(): number {
    return this.maxConnectionsPerUser;
  }

  /**
   * 사용자의 남은 연결 수 조회
   */
  getRemainingConnections(userId: string): number {
    return Math.max(
      0,
      this.maxConnectionsPerUser - this.getUserConnectionCount(userId),
    );
  }
}
