import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { UseGuards, ExecutionContext } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { UserConnectionService } from './user-connection.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import {
  MessageThrottlerGuard,
  TypingThrottlerGuard,
  SpamThrottlerGuard,
  RoomThrottlerGuard,
  LongMessageThrottlerGuard,
} from '../common/guards/throttle.guard';
import { SendMessageDto, TypingDto } from '../common/dto/message.dto';
import { SanitizerUtil } from '../common/utils/sanitizer.util';
import type { UserWithoutPassword } from '../auth/types/user.types';

interface AuthenticatedSocket extends Socket {
  data: {
    user: UserWithoutPassword;
  };
}

interface MockExecutionContext {
  switchToWs: () => { getClient: () => AuthenticatedSocket };
  getHandler: () => { name: string };
  getClass: () => { name: string };
  getArgs: () => unknown[];
  getArgByIndex: (index: number) => unknown;
  switchToRpc: () => unknown;
  switchToHttp: () => unknown;
  getType: () => string;
}

@WebSocketGateway({
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      // 모바일 개발 환경 지원
      /^http:\/\/192\.168\.\d+\.\d+:3000$/, // 로컬 네트워크 IP
      /^http:\/\/192\.168\.\d+\.\d+:3001$/, // 로컬 네트워크 IP
      /^http:\/\/10\.\d+\.\d+\.\d+:3000$/, // 사설 IP 대역
      /^http:\/\/10\.\d+\.\d+\.\d+:3001$/, // 사설 IP 대역
    ],
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private llmService: LlmService,
    private prismaService: PrismaService,
    private embeddingService: EmbeddingService,
    private userConnectionService: UserConnectionService,
    private telemetryService: TelemetryService,
  ) {
    // JWT 설정 확인
    console.log('JWT Secret configured:', !!process.env.JWT_SECRET);
  }

  async afterInit(server: Server) {
    try {
      // Redis 클라이언트가 준비될 때까지 대기
      const pubClient = this.redisService.getClient();

      if (!pubClient) {
        console.error('Redis client is not initialized');
        return;
      }

      // Redis 연결 상태 확인
      await this.redisService.ping();

      const subClient = pubClient.duplicate();
      server.adapter(createAdapter(pubClient, subClient));
      console.log('Redis Adapter initialized for Socket.IO');
    } catch (error) {
      console.error('Failed to initialize Redis Adapter:', error);
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // JWT 토큰을 쿼리 파라미터나 헤더에서 가져오기
      const token: string | undefined =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers.authorization as string)?.replace(
          'Bearer ',
          '',
        ) ||
        (client.handshake.query.token as string);

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

      // JWT 토큰 검증
      let payload: { sub: string; email: string };
      try {
        // JWT 서비스와 동일한 시크릿 사용
        const secret =
          process.env.JWT_SECRET ||
          'your-super-secret-jwt-key-change-in-production';
        payload = this.jwtService.verify(token, { secret });
        console.log('JWT payload verified:', {
          sub: payload.sub,
          email: payload.email,
        });

        // 토큰이 블랙리스트에 있는지 확인
        const isBlacklisted = await this.authService.isTokenBlacklisted(token);
        if (isBlacklisted) {
          console.error('Token is blacklisted');
          client.emit('error', { message: '토큰이 무효화되었습니다.' });
          client.disconnect();
          return;
        }
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError);
        client.emit('error', { message: '유효하지 않은 토큰입니다.' });
        client.disconnect();
        return;
      }

      const user = await this.authService.validateUser(payload.sub);
      console.log(
        'User validation result:',
        user ? { id: user.id, name: user.name } : 'null',
      );

      if (!user) {
        console.error('User validation failed for user ID:', payload.sub);
        client.emit('error', { message: '유효하지 않은 사용자입니다.' });
        client.disconnect();
        return;
      }

      // 사용자 정보를 소켓에 저장
      client.data.user = user;

      // 사용자 연결 관리에 추가 (연결 제한 검사)
      const userAgent = client.handshake.headers['user-agent'] as string;
      const connectionAdded = this.userConnectionService.addConnection(
        user.id,
        client,
        userAgent,
      );

      if (!connectionAdded) {
        console.error(`User ${user.id} exceeded maximum connections`);
        client.emit('error', {
          message: `최대 연결 수(${this.userConnectionService.getMaxConnectionsPerUser()})를 초과했습니다.`,
          code: 'MAX_CONNECTIONS_EXCEEDED',
        });
        client.disconnect();
        return;
      }

      // 사용자를 개인 룸에 조인 (개인 메시지용)
      void client.join(`user:${user.id}`);

      // 사용자가 참여 중인 룸 목록 조회 및 자동 참여
      const userRooms = await this.getUserRooms(user.id);
      userRooms.forEach((roomId) => {
        void client.join(`room:${roomId}`);
      });

      // 메트릭 기록
      this.telemetryService.recordSocketConnection(1);
      this.telemetryService.recordUserSessions(1, 'active');

      console.log(
        `Client connected: ${user.id} (${user.name}) - Device: ${userAgent}`,
      );

      // 연결 성공 이벤트 전송
      client.emit('connected', {
        message: '연결되었습니다.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        deviceCount: this.userConnectionService.getUserConnectionCount(user.id),
        maxConnections: this.userConnectionService.getMaxConnectionsPerUser(),
        remainingConnections:
          this.userConnectionService.getRemainingConnections(user.id),
        autoJoinedRooms: userRooms,
      });

      // 사용자 상태 브로드캐스트 (다른 사용자들에게)
      this.server.emit('user_status', {
        userId: user.id,
        userName: user.name,
        status: 'online',
        deviceCount: this.userConnectionService.getUserConnectionCount(user.id),
      });
    } catch (error) {
      console.error('Connection error:', error);
      const errorMessage =
        error instanceof Error ? error.message : '인증에 실패했습니다.';
      client.emit('error', { message: errorMessage });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.userConnectionService.getUserId(client.id);

    if (userId) {
      // 사용자 연결 제거
      const wasLastConnection =
        this.userConnectionService.removeConnection(client);

      // 메트릭 기록
      this.telemetryService.recordSocketConnection(-1);
      if (wasLastConnection) {
        this.telemetryService.recordUserSessions(-1, 'active');
      }

      console.log(
        `Client disconnected: ${userId} (${client.data?.user?.name || 'Unknown'})`,
      );

      // 마지막 연결이 끊어진 경우에만 오프라인 상태 브로드캐스트
      if (wasLastConnection) {
        this.server.emit('user_status', {
          userId,
          userName: client.data?.user?.name || 'Unknown',
          status: 'offline',
          deviceCount: 0,
        });
      } else {
        // 다른 디바이스가 여전히 연결되어 있는 경우 디바이스 수 업데이트
        this.server.emit('user_status', {
          userId,
          userName: client.data?.user?.name || 'Unknown',
          status: 'online',
          deviceCount:
            this.userConnectionService.getUserConnectionCount(userId),
        });
      }
    } else {
      console.log(`Client disconnected: ${client.id} (unauthenticated)`);
    }
  }

  private async ensureRoomExists(roomId: string): Promise<void> {
    try {
      const existingRoom = await this.prismaService.room.findUnique({
        where: { id: roomId },
      });

      if (!existingRoom) {
        // 방이 존재하지 않으면 생성
        await this.prismaService.room.create({
          data: {
            id: roomId,
            name: roomId, // roomId를 이름으로 사용
          },
        });
        console.log(`Room created: ${roomId}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to ensure room exists: ${errorMessage}`);
      throw error;
    }
  }

  @UseGuards(RoomThrottlerGuard)
  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string },
  ) {
    try {
      const { roomId } = payload;
      const user = client.data.user;

      if (!user) {
        throw new UnauthorizedException('인증되지 않은 사용자입니다.');
      }

      // 방이 존재하는지 확인하고, 없으면 생성
      await this.ensureRoomExists(roomId);

      // 기존 룸에서 나가기
      client.rooms.forEach((room) => {
        if (room.startsWith('room:')) {
          void client.leave(room);
        }
      });

      // 새 룸에 조인
      void client.join(`room:${roomId}`);

      console.log(`User ${user.name} joined room: ${roomId}`);

      // 룸의 다른 사용자들에게 알림
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
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';
      client.emit('error', { message: errorMessage });
      return { event: 'error', data: { message: errorMessage } };
    }
  }

  @UseGuards(RoomThrottlerGuard)
  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string },
  ) {
    try {
      const { roomId } = payload;
      const user = client.data.user;

      if (!user) {
        throw new UnauthorizedException('인증되지 않은 사용자입니다.');
      }

      // 룸에서 나가기
      void client.leave(`room:${roomId}`);

      console.log(`User ${user.name} left room: ${roomId}`);

      // 룸의 다른 사용자들에게 알림
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
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';
      client.emit('error', { message: errorMessage });
      return { event: 'error', data: { message: errorMessage } };
    }
  }

  @UseGuards(MessageThrottlerGuard, SpamThrottlerGuard)
  @SubscribeMessage('send')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessageDto,
  ) {
    try {
      const { roomId, text } = payload;
      const user = client.data.user;

      if (!user) {
        throw new UnauthorizedException('인증되지 않은 사용자입니다.');
      }

      // 입력 검증 및 정화
      if (!text || text.trim().length === 0) {
        throw new BadRequestException('메시지 내용이 비어있습니다.');
      }

      // 메시지 정화 (XSS 방지)
      const sanitizedText = SanitizerUtil.sanitizeMessage(text);

      // 정화 후 빈 메시지인지 확인
      if (sanitizedText.length === 0) {
        throw new BadRequestException('유효하지 않은 메시지 내용입니다.');
      }

      // 입력 검증
      const validation = SanitizerUtil.validateInput(sanitizedText, {
        minLength: 1,
        maxLength: 2000,
        allowSpecialChars: true,
      });

      if (!validation.isValid) {
        throw new BadRequestException(validation.error);
      }

      // 긴 메시지에 대한 추가 제한 (1500자 이상)
      const longMessageThreshold = 1500;
      if (sanitizedText.length >= longMessageThreshold) {
        // 긴 메시지 전송 제한을 별도로 적용
        const longMessageGuard = new LongMessageThrottlerGuard(
          this.redisService,
        );
        const mockContext: MockExecutionContext = {
          switchToWs: () => ({ getClient: () => client }),
          getHandler: () => ({ name: 'send' }),
          getClass: () => ({ name: 'ChatGateway' }),
          getArgs: () => [],
          getArgByIndex: () => undefined,
          switchToRpc: () => ({}) as unknown,
          switchToHttp: () => ({}) as unknown,
          getType: () => 'ws',
        };
        const canSendLongMessage = await longMessageGuard.canActivate(
          mockContext as ExecutionContext,
        );
        if (!canSendLongMessage) {
          throw new BadRequestException(
            '긴 메시지 전송이 너무 빈번합니다. 잠시 후 다시 시도해주세요.',
          );
        }
      }

      if (!roomId || roomId.trim().length === 0) {
        throw new BadRequestException('룸 ID가 필요합니다.');
      }

      // 룸 ID도 정화
      const sanitizedRoomId = SanitizerUtil.sanitizeForSql(roomId.trim());

      console.log(
        `Message from ${user.name} in room ${sanitizedRoomId}: ${sanitizedText}`,
      );

      // 사용자 메시지 저장
      const userMessageId = await this.llmService.saveMessage(
        sanitizedRoomId,
        sanitizedText,
        'user',
        user.id,
      );

      // 사용자 메시지 임베딩 생성 및 저장 (백그라운드에서 처리)
      this.embeddingService.processEmbeddingsInBackground([
        {
          id: userMessageId,
          content: sanitizedText,
        },
      ]);

      // 사용자 메시지 객체 생성 (데이터베이스 ID 사용)
      const userMessage = {
        id: userMessageId, // 데이터베이스에서 생성된 실제 ID 사용
        userId: user.id,
        userName: user.name,
        text: sanitizedText,
        roomId: sanitizedRoomId,
        timestamp: new Date().toISOString(),
      };

      // 룸의 모든 사용자에게 사용자 메시지 전송
      this.server.to(`room:${sanitizedRoomId}`).emit('message', userMessage);

      // 메트릭 기록
      this.telemetryService.recordMessage('user', sanitizedRoomId);

      // 스트리밍 시작 알림
      this.server.to(`room:${sanitizedRoomId}`).emit('stream', { start: true });

      try {
        // LLM 응답 생성
        const messages = await this.llmService.prepareMessages(
          sanitizedText,
          sanitizedRoomId,
        );

        await this.llmService.generateChatResponse(messages, {
          onToken: (token) => {
            // 각 토큰을 실시간으로 전송
            this.server.to(`room:${sanitizedRoomId}`).emit('stream', { token });
          },
          onComplete: (fullResponse) => {
            // 완전한 응답을 데이터베이스에 저장 (비동기 처리)
            this.llmService
              .saveMessage(sanitizedRoomId, fullResponse, 'assistant')
              .then((assistantMessageId) => {
                // 어시스턴트 메시지 임베딩 생성 및 저장 (백그라운드에서 처리)
                this.embeddingService.processEmbeddingsInBackground([
                  {
                    id: assistantMessageId,
                    content: fullResponse,
                  },
                ]);

                // AI 응답을 메시지로 전송 (중복 방지를 위해 데이터베이스 ID 사용)
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

                // 메트릭 기록
                this.telemetryService.recordMessage(
                  'assistant',
                  sanitizedRoomId,
                );
              })
              .catch((error) => {
                console.error('Failed to save assistant message:', error);
              });

            // 스트리밍 종료 알림
            this.server
              .to(`room:${sanitizedRoomId}`)
              .emit('stream', { end: true });
          },
          onError: (error) => {
            console.error('LLM error:', error);
            const errorMessage =
              error.message || 'AI 응답 생성 중 오류가 발생했습니다.';
            this.server.to(`room:${sanitizedRoomId}`).emit('error', {
              message: errorMessage,
            });
            this.server
              .to(`room:${sanitizedRoomId}`)
              .emit('stream', { end: true });
          },
        });
      } catch (llmError) {
        console.error('LLM service error:', llmError);
        const errorMessage =
          llmError instanceof Error
            ? llmError.message
            : 'AI 서비스에 연결할 수 없습니다.';
        this.server.to(`room:${sanitizedRoomId}`).emit('error', {
          message: errorMessage,
        });
        this.server.to(`room:${sanitizedRoomId}`).emit('stream', { end: true });
      }

      // 발신자에게 전송 확인
      return {
        event: 'sent',
        data: {
          messageId: userMessage.id,
          roomId: sanitizedRoomId,
          text: userMessage.text,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';
      client.emit('error', { message: errorMessage });
      return { event: 'error', data: { message: errorMessage } };
    }
  }

  @UseGuards(TypingThrottlerGuard)
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingDto,
  ) {
    try {
      const { roomId, status } = payload;
      const user = client.data.user;
      const isTyping = status === 'start';

      if (!user) {
        throw new UnauthorizedException('인증되지 않은 사용자입니다.');
      }

      // 룸의 다른 사용자들에게 타이핑 상태 전송
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
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';
      client.emit('error', { message: errorMessage });
      return { event: 'error', data: { message: errorMessage } };
    }
  }

  @SubscribeMessage('getRooms')
  handleGetRooms(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const user = client.data.user;

      if (!user) {
        throw new UnauthorizedException('인증되지 않은 사용자입니다.');
      }

      // 사용자가 속한 룸 목록 반환
      const userRooms = Array.from(client.rooms)
        .filter((room) => room.startsWith('room:'))
        .map((room) => room.replace('room:', ''));

      return {
        event: 'rooms',
        data: { rooms: userRooms, userId: user.id },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';
      client.emit('error', { message: errorMessage });
      return { event: 'error', data: { message: errorMessage } };
    }
  }

  /**
   * 사용자가 참여 중인 룸 목록 조회
   */
  private async getUserRooms(userId: string): Promise<string[]> {
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
    } catch (error) {
      console.error('Failed to get user rooms:', error);
      return [];
    }
  }

  /**
   * 디바이스 간 메시지 읽음 상태 동기화
   */
  @SubscribeMessage('sync_read')
  handleSyncRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; messageId: string },
  ) {
    try {
      const user = client.data.user;

      if (!user) {
        throw new UnauthorizedException('인증되지 않은 사용자입니다.');
      }

      const { roomId, messageId } = payload;

      // 같은 사용자의 다른 디바이스에 읽음 상태 동기화
      this.userConnectionService.sendToUserExcept(
        this.server,
        user.id,
        client.id,
        'read_receipt',
        {
          roomId,
          messageId,
          userId: user.id,
          timestamp: new Date().toISOString(),
        },
      );

      return {
        event: 'read_synced',
        data: { roomId, messageId },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';
      client.emit('error', { message: errorMessage });
      return { event: 'error', data: { message: errorMessage } };
    }
  }

  /**
   * 디바이스 간 타이핑 상태 동기화
   */
  @SubscribeMessage('sync_typing')
  handleSyncTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; isTyping: boolean },
  ) {
    try {
      const user = client.data.user;

      if (!user) {
        throw new UnauthorizedException('인증되지 않은 사용자입니다.');
      }

      const { roomId, isTyping } = payload;

      // 같은 사용자의 다른 디바이스에 타이핑 상태 동기화
      this.userConnectionService.sendToUserExcept(
        this.server,
        user.id,
        client.id,
        'user_typing_sync',
        {
          roomId,
          isTyping,
          userId: user.id,
          userName: user.name,
          timestamp: new Date().toISOString(),
        },
      );

      return {
        event: 'typing_synced',
        data: { roomId, isTyping },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';
      client.emit('error', { message: errorMessage });
      return { event: 'error', data: { message: errorMessage } };
    }
  }

  /**
   * 사용자 디바이스 정보 조회
   */
  @SubscribeMessage('get_devices')
  handleGetDevices(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const user = client.data.user;

      if (!user) {
        throw new UnauthorizedException('인증되지 않은 사용자입니다.');
      }

      const devices = this.userConnectionService.getUserDevices(user.id);
      const connectionCount = this.userConnectionService.getUserConnectionCount(
        user.id,
      );

      return {
        event: 'devices',
        data: {
          devices,
          connectionCount,
          userId: user.id,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';
      client.emit('error', { message: errorMessage });
      return { event: 'error', data: { message: errorMessage } };
    }
  }

  /**
   * 연결 통계 조회 (관리자용)
   */
  @SubscribeMessage('get_connection_stats')
  handleGetConnectionStats(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const user = client.data.user;

      if (!user) {
        throw new UnauthorizedException('인증되지 않은 사용자입니다.');
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
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';
      client.emit('error', { message: errorMessage });
      return { event: 'error', data: { message: errorMessage } };
    }
  }
}
