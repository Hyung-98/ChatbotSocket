import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ErrorLoggerService } from '../services/error-logger.service';
export declare class ErrorLoggingInterceptor implements NestInterceptor {
    private errorLogger;
    private readonly logger;
    constructor(errorLogger: ErrorLoggerService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
    private sanitizeBody;
}
