import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MonitoringService } from '../../monitoring/monitoring.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(private monitoringService: MonitoringService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        this.monitoringService.recordPerformanceMetric(
          responseTime,
          url,
          method,
        );
      }),
    );
  }
}
