import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto, RegisterDto, AuthResponse } from './dto/auth.dto';
import type { UserWithoutPassword } from './types/user.types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name } = registerDto;

    // 이메일 중복 확인
    const existingUser = (await this.prisma.user.findUnique({
      where: { email },
    })) as {
      id: string;
      email: string;
      name: string;
      role: string;
      isActive: boolean;
      lastLogin: Date | null;
      createdAt: Date;
    } | null;

    if (existingUser) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 12);

    // 사용자 생성
    const user = (await this.prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    })) as {
      id: string;
      email: string;
      name: string;
      role: string;
      isActive: boolean;
      lastLogin: Date | null;
      createdAt: Date;
    };

    // JWT 토큰 생성
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessToken,
      refreshToken,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // 사용자 찾기
    const user = (await this.prisma.user.findUnique({
      where: { email },
    })) as {
      id: string;
      email: string;
      name: string;
      role: string;
      isActive: boolean;
      lastLogin: Date | null;
      createdAt: Date;
      password: string;
    } | null;

    if (!user) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // JWT 토큰 생성
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessToken,
      refreshToken,
    };
  }

  async validateUser(userId: string): Promise<UserWithoutPassword | null> {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as {
      id: string;
      email: string;
      name: string;
      role: string;
      isActive: boolean;
      lastLogin: Date | null;
      createdAt: Date;
    } | null;

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // 리프레시 토큰으로 액세스 토큰 갱신
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = (await this.prisma.user.findUnique({
        where: { id: payload.sub },
      })) as {
        id: string;
        email: string;
        name: string;
        role: string;
        isActive: boolean;
        lastLogin: Date | null;
        createdAt: Date;
      } | null;

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload = { sub: user.id, email: user.email };
      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: '1h',
      });

      return { accessToken: newAccessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // 토큰 블랙리스트에 추가
  async addToBlacklist(token: string, expiresIn: number): Promise<void> {
    const redis = this.redisService.getClient();
    if (redis) {
      await redis.setEx(`blacklist:${token}`, expiresIn, 'true');
    }
  }

  // 토큰이 블랙리스트에 있는지 확인
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const redis = this.redisService.getClient();
    if (!redis) return false;
    const result = await redis.get(`blacklist:${token}`);
    return result === 'true';
  }

  // 로그아웃 시 토큰을 블랙리스트에 추가
  async logout(accessToken: string, refreshToken: string): Promise<void> {
    try {
      // 액세스 토큰의 남은 만료 시간 계산
      const accessPayload = this.jwtService.decode(accessToken);
      const refreshPayload = this.jwtService.decode(refreshToken);

      if (accessPayload && accessPayload.exp) {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = accessPayload.exp - now;
        if (expiresIn > 0) {
          await this.addToBlacklist(accessToken, expiresIn);
        }
      }

      if (refreshPayload && refreshPayload.exp) {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = refreshPayload.exp - now;
        if (expiresIn > 0) {
          await this.addToBlacklist(refreshToken, expiresIn);
        }
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  // 개발용: 모든 사용자 조회 (보안상 프로덕션에서는 제거)
  async getAllUsers(): Promise<UserWithoutPassword[]> {
    const users = (await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })) as Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    return users;
  }
}
