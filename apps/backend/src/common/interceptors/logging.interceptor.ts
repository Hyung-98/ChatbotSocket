import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { TelemetryService } from '../../telemetry/telemetry.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly telemetryService: TelemetryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const durationSeconds = duration / 1000;

        // 메트릭 기록
        const requestWithRoute = request as Request & {
          route?: { path?: string };
        };
        this.telemetryService.recordRequestDuration(
          request.method,
          requestWithRoute.route?.path || request.url,
          response.statusCode.toString(),
          durationSeconds,
        );

        // 로그 출력
        console.log(
          `${request.method} ${request.url} ${response.statusCode} - ${duration}ms`,
        );
      }),
    );
  }
}
