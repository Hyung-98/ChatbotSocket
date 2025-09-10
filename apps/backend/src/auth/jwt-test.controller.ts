import { Controller, Get, Post, Body, Headers } from '@nestjs/common';
import { JwtUtil } from './jwt.util';

@Controller('jwt-test')
export class JwtTestController {
  @Post('create-token')
  createToken(@Body() body: { userId: string; email: string }) {
    const token = JwtUtil.sign({
      sub: body.userId,
      email: body.email,
    });

    return {
      token,
      message: 'Token created successfully',
    };
  }

  @Get('verify-token')
  verifyToken(@Headers('authorization') auth: string) {
    if (!auth || !auth.startsWith('Bearer ')) {
      return { error: 'No token provided' };
    }

    const token = auth.substring(7);

    try {
      const payload = JwtUtil.verify(token);
      return {
        valid: true,
        payload,
        message: 'Token is valid',
      };
    } catch {
      return {
        valid: false,
        error: 'Invalid token',
      };
    }
  }

  @Get('decode-token')
  decodeToken(@Headers('authorization') auth: string) {
    if (!auth || !auth.startsWith('Bearer ')) {
      return { error: 'No token provided' };
    }

    const token = auth.substring(7);
    const decoded = JwtUtil.decode(token);

    return {
      decoded,
      isExpired: JwtUtil.isExpired(token),
    };
  }

  @Get('token-info')
  getTokenInfo(@Headers('authorization') auth: string) {
    if (!auth || !auth.startsWith('Bearer ')) {
      return { error: 'No token provided' };
    }

    const token = auth.substring(7);

    return {
      userId: JwtUtil.getUserId(token),
      email: JwtUtil.getEmail(token),
      isExpired: JwtUtil.isExpired(token),
    };
  }
}
