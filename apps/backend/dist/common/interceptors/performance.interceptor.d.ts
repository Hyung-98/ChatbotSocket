import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MonitoringService } from '../../monitoring/monitoring.service';
export declare class PerformanceInterceptor implements NestInterceptor {
    private monitoringService;
    constructor(monitoringService: MonitoringService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
