import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Request } from 'express';
import { ErrorLoggerService } from '../services/error-logger.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

interface ErrorWithStatus extends Error {
  status?: number;
}

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorLoggingInterceptor.name);

  constructor(private errorLogger: ErrorLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { method, url, body } = request;
    const user = request.user;

    return next.handle().pipe(
      catchError((error: Error) => {
        // 에러 로그 생성
        const errorWithStatus = error as ErrorWithStatus;
        const errorData = {
          level: 'error' as const,
          message: error.message || 'Unknown error occurred',
          context: `${method} ${url}`,
          metadata: {
            method,
            url,
            body: this.sanitizeBody(body),
            userId: user?.id,
            userEmail: user?.email,
            stack: error.stack,
            statusCode: errorWithStatus.status || 500,
          },
          userId: user?.id,
          stack: error.stack,
        };

        // 에러 로그 저장
        void this.errorLogger.logError(errorData);

        return throwError(() => error);
      }),
    );
  }

  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') return null;

    // 민감한 정보 제거
    const sanitized = { ...(body as Record<string, unknown>) };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
