import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { method, originalUrl } = req;
      const { statusCode } = res;

      if (originalUrl.startsWith('/api/health')) return; // skip health check noise

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${duration}ms`,
      );
    });

    next();
  }
}
