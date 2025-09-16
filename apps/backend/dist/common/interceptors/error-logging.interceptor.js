"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ErrorLoggingInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorLoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const error_logger_service_1 = require("../services/error-logger.service");
let ErrorLoggingInterceptor = ErrorLoggingInterceptor_1 = class ErrorLoggingInterceptor {
    errorLogger;
    logger = new common_1.Logger(ErrorLoggingInterceptor_1.name);
    constructor(errorLogger) {
        this.errorLogger = errorLogger;
    }
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const { method, url, body } = request;
        const user = request.user;
        return next.handle().pipe((0, operators_1.catchError)((error) => {
            const errorWithStatus = error;
            const errorData = {
                level: 'error',
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
            void this.errorLogger.logError(errorData);
            return (0, rxjs_1.throwError)(() => error);
        }));
    }
    sanitizeBody(body) {
        if (!body || typeof body !== 'object')
            return null;
        const sanitized = { ...body };
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }
        return sanitized;
    }
};
exports.ErrorLoggingInterceptor = ErrorLoggingInterceptor;
exports.ErrorLoggingInterceptor = ErrorLoggingInterceptor = ErrorLoggingInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [error_logger_service_1.ErrorLoggerService])
], ErrorLoggingInterceptor);
//# sourceMappingURL=error-logging.interceptor.js.map