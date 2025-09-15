import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TelemetryService } from '../../telemetry/telemetry.service';
export declare class LoggingInterceptor implements NestInterceptor {
    private readonly telemetryService;
    constructor(telemetryService: TelemetryService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
