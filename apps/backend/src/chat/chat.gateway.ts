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
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import type { UserWithoutPassword } from '../auth/types/user.types';

interface AuthenticatedSocket extends Socket {
  data: {
    user: UserWithoutPassword;
  };
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
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

      // 사용자를 개인 룸에 조인 (개인 메시지용)
      void client.join(`user:${user.id}`);

      console.log(`Client connected: ${user.id} (${user.name})`);

      // 연결 성공 이벤트 전송
      client.emit('connected', {
        message: '연결되었습니다.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
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
    if (client.data?.user) {
      console.log(
        `Client disconnected: ${client.data.user.id} (${client.data.user.name})`,
      );
    } else {
      console.log(`Client disconnected: ${client.id}`);
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

  @SubscribeMessage('send')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; text: string },
  ) {
    try {
      const { roomId, text } = payload;
      const user = client.data.user;

      if (!user) {
        throw new UnauthorizedException('인증되지 않은 사용자입니다.');
      }

      if (!text || text.trim().length === 0) {
        throw new Error('메시지 내용을 입력해주세요.');
      }

      const trimmedText = text.trim();
      console.log(
        `Message from ${user.name} in room ${roomId}: ${trimmedText}`,
      );

      // 사용자 메시지 저장
      await this.llmService.saveMessage(roomId, trimmedText, 'user', user.id);

      // 사용자 메시지 객체 생성
      const userMessage = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        userName: user.name,
        text: trimmedText,
        roomId,
        timestamp: new Date().toISOString(),
      };

      // 룸의 모든 사용자에게 사용자 메시지 전송
      this.server.to(`room:${roomId}`).emit('message', userMessage);

      // 스트리밍 시작 알림
      this.server.to(`room:${roomId}`).emit('stream', { start: true });

      try {
        // LLM 응답 생성
        const messages = await this.llmService.prepareMessages(
          trimmedText,
          roomId,
        );

        await this.llmService.generateChatResponse(messages, {
          onToken: (token) => {
            // 각 토큰을 실시간으로 전송
            this.server.to(`room:${roomId}`).emit('stream', { token });
          },
          onComplete: (fullResponse) => {
            // 완전한 응답을 데이터베이스에 저장
            this.llmService
              .saveMessage(roomId, fullResponse, 'assistant')
              .catch((error) => {
                console.error('Failed to save assistant message:', error);
              });

            // 스트리밍 종료 알림 (AI 응답은 stream 이벤트로만 처리)
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
      } catch (llmError) {
        console.error('LLM service error:', llmError);
        this.server.to(`room:${roomId}`).emit('error', {
          message: 'AI 서비스에 연결할 수 없습니다.',
        });
        this.server.to(`room:${roomId}`).emit('stream', { end: true });
      }

      // 발신자에게 전송 확인
      return {
        event: 'sent',
        data: { messageId: userMessage.id, roomId, text: userMessage.text },
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

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; isTyping: boolean },
  ) {
    try {
      const { roomId, isTyping } = payload;
      const user = client.data.user;

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
}
