import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private jwtAuthGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // JWT 인증 먼저 확인
    const isAuthenticated = await this.jwtAuthGuard.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    // 사용자 정보 가져오기
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('사용자 정보를 찾을 수 없습니다.');
    }

    // 관리자 권한 확인
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }

    return true;
  }
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private jwtAuthGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // JWT 인증 먼저 확인
    const isAuthenticated = await this.jwtAuthGuard.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    // 사용자 정보 가져오기
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('사용자 정보를 찾을 수 없습니다.');
    }

    // 슈퍼 관리자 권한 확인
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('슈퍼 관리자 권한이 필요합니다.');
    }

    return true;
  }
}
