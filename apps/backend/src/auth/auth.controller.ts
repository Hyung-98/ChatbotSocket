import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { LoginDto, RegisterDto, AuthResponse } from './dto/auth.dto';
import type { UserWithoutPassword } from './types/user.types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(
    @Request() req: { user: UserWithoutPassword },
  ): UserWithoutPassword {
    return req.user;
  }

  // 개발용: 사용자 목록 조회 (보안상 프로덕션에서는 제거)
  @Get('users')
  async getUsers() {
    return this.authService.getAllUsers();
  }
}
