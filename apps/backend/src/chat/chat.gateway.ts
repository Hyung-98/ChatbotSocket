import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
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
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // JWT 토큰을 쿼리 파라미터나 헤더에서 가져오기
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '') ||
        (client.handshake.query.token as string);

      if (!token) {
        client.emit('error', { message: '인증 토큰이 필요합니다.' });
        client.disconnect();
        return;
      }

      // JWT 토큰 검증
      const payload = this.jwtService.verify(token);
      const user = await this.authService.validateUser(payload.sub);

      if (!user) {
        client.emit('error', { message: '유효하지 않은 토큰입니다.' });
        client.disconnect();
        return;
      }

      // 사용자 정보를 소켓에 저장
      client.data.user = user;

      // 사용자를 개인 룸에 조인 (개인 메시지용)
      client.join(`user:${user.id}`);

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
      client.emit('error', { message: '인증에 실패했습니다.' });
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

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string },
  ) {
    try {
      const { roomId } = payload;
      const user = client.data.user;

      if (!user) {
        throw new UnauthorizedException('인증되지 않은 사용자입니다.');
      }

      // 기존 룸에서 나가기
      client.rooms.forEach((room) => {
        if (room.startsWith('room:')) {
          client.leave(room);
        }
      });

      // 새 룸에 조인
      client.join(`room:${roomId}`);

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
      client.emit('error', { message: error.message });
      return { event: 'error', data: { message: error.message } };
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
      client.leave(`room:${roomId}`);

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
      client.emit('error', { message: error.message });
      return { event: 'error', data: { message: error.message } };
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

      // 메시지 객체 생성
      const message = {
        id: Math.random().toString(36).substr(2, 9), // 임시 ID
        userId: user.id,
        userName: user.name,
        text: text.trim(),
        roomId,
        timestamp: new Date().toISOString(),
      };

      console.log(`Message from ${user.name} in room ${roomId}: ${text}`);

      // 룸의 모든 사용자에게 메시지 전송
      this.server.to(`room:${roomId}`).emit('message', message);

      // 발신자에게 전송 확인
      return {
        event: 'sent',
        data: { messageId: message.id, roomId, text: message.text },
      };
    } catch (error) {
      client.emit('error', { message: error.message });
      return { event: 'error', data: { message: error.message } };
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
      client.emit('error', { message: error.message });
      return { event: 'error', data: { message: error.message } };
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
      client.emit('error', { message: error.message });
      return { event: 'error', data: { message: error.message } };
    }
  }
}
