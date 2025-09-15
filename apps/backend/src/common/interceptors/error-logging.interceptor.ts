import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorLoggerService } from '../services/error-logger.service';

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorLoggingInterceptor.name);

  constructor(private errorLogger: ErrorLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;

    return next.handle().pipe(
      catchError((error) => {
        // 에러 로그 생성
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
            statusCode: error.status || 500,
          },
          userId: user?.id,
          stack: error.stack,
        };

        // 에러 로그 저장
        this.errorLogger.logError(errorData);

        return throwError(() => error);
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;

    // 민감한 정보 제거
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
