import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto, RegisterDto, AuthResponse } from './dto/auth.dto';
import type { UserWithoutPassword } from './types/user.types';
import { JwtUtil } from './jwt.util';

@Injectable()
export class AuthJwtService {
  constructor(private prisma: PrismaService) {}

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

    // jsonwebtoken을 사용한 JWT 토큰 생성
    const payload = { sub: user.id, email: user.email };
    const accessToken = JwtUtil.sign(payload, { expiresIn: '1h' });
    const refreshToken = JwtUtil.sign(payload, { expiresIn: '7d' });

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

    // jsonwebtoken을 사용한 JWT 토큰 생성
    const payload = { sub: user.id, email: user.email };
    const accessToken = JwtUtil.sign(payload, { expiresIn: '1h' });
    const refreshToken = JwtUtil.sign(payload, { expiresIn: '7d' });

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
      updatedAt: user.updatedAt as Date,
    };
  }

  // JWT 토큰 검증
  async verifyToken(token: string): Promise<UserWithoutPassword | null> {
    try {
      const payload = JwtUtil.verify(token) as { sub: string };
      return this.validateUser(payload.sub);
    } catch {
      return null;
    }
  }

  // 토큰에서 사용자 정보 추출
  async getUserFromToken(token: string): Promise<UserWithoutPassword | null> {
    try {
      const userId = JwtUtil.getUserId(token);
      if (!userId) return null;

      return this.validateUser(userId);
    } catch {
      return null;
    }
  }
}
