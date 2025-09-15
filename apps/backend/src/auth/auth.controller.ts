import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CsrfTokenGenerator } from '../common/middleware/csrf.middleware';
import type {
  LoginDto,
  RegisterDto,
  AuthResponse,
  RefreshTokenDto,
  RefreshTokenResponse,
} from './dto/auth.dto';
import type { UserWithoutPassword } from './types/user.types';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private csrfTokenGenerator: CsrfTokenGenerator,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 1분에 5회
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    console.log('회원가입 요청 받음:', {
      email: registerDto.email,
      name: registerDto.name,
      hasPassword: !!registerDto.password,
    });

    try {
      const result = await this.authService.register(registerDto);
      console.log('회원가입 성공:', { id: result.id, email: result.email });
      return result;
    } catch (error) {
      console.error('회원가입 실패:', error);
      throw error;
    }
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 1분에 10회
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 1분에 20회
  @Post('refresh')
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<RefreshTokenResponse> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Request()
    req: {
      user: UserWithoutPassword;
      headers: { authorization: string };
    },
  ): Promise<{ message: string }> {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      throw new UnauthorizedException('액세스 토큰이 필요합니다.');
    }

    // 리프레시 토큰은 클라이언트에서 별도로 관리하므로
    // 여기서는 액세스 토큰만 블랙리스트에 추가
    await this.authService.addToBlacklist(accessToken, 3600); // 1시간

    return { message: '로그아웃되었습니다.' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(
    @Request() req: { user: UserWithoutPassword },
  ): UserWithoutPassword {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: { user: UserWithoutPassword }): UserWithoutPassword {
    return req.user;
  }

  // CSRF 토큰 발급
  @Get('csrf-token')
  async getCsrfToken(
    @Request() req: Request,
  ): Promise<{ csrfToken: string; sessionId: string }> {
    const sessionId =
      (req.headers['x-session-id'] as string) || crypto.randomUUID();
    const csrfToken = this.csrfTokenGenerator.generateToken();

    // 토큰을 Redis에 저장 (1시간 유효)
    await this.csrfTokenGenerator.storeToken(sessionId, csrfToken, 3600);

    return { csrfToken, sessionId };
  }

  // 개발용: 사용자 목록 조회 (보안상 프로덕션에서는 제거)
  @Get('users')
  async getUsers() {
    return this.authService.getAllUsers();
  }
}
