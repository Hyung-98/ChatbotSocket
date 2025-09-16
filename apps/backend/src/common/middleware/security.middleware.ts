import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Helmet 보안 헤더 설정
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    })(req, res, next);
  }
}

@Injectable()
export class InputSanitizationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // XSS 방지를 위한 기본적인 입력 정리
    if (req.body) {
      this.sanitizeObject(req.body as Record<string, unknown>);
    }
    if (req.query) {
      this.sanitizeObject(req.query as Record<string, unknown>);
    }
    if (req.params) {
      this.sanitizeObject(req.params as Record<string, unknown>);
    }
    next();
  }

  private sanitizeObject(obj: Record<string, unknown>): void {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // 기본적인 HTML 태그 제거
        obj[key] = (obj[key] as string)
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]*>/g, '')
          .trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeObject(obj[key] as Record<string, unknown>);
      }
    }
  }
}
