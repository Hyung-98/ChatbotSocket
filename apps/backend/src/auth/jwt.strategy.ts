import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import type { JwtPayload, UserWithoutPassword } from './types/user.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET ||
        'your-super-secret-jwt-key-change-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<UserWithoutPassword> {
    // 토큰이 블랙리스트에 있는지 확인
    const payloadWithJti = payload as { sub: string; jti?: string };
    const isBlacklisted = await this.authService.isTokenBlacklisted(
      payloadWithJti.jti || payloadWithJti.sub, // jti (JWT ID) 또는 sub를 사용
    );

    if (isBlacklisted) {
      throw new UnauthorizedException('토큰이 무효화되었습니다.');
    }

    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    return user;
  }
}
