import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
export declare class SecurityMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction): void;
}
export declare class InputSanitizationMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction): void;
    private sanitizeObject;
}
