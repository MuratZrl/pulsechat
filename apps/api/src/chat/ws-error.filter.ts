import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

const CODE_BY_STATUS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/**
 * Error boundary for socket handlers. Deliberate rejections — WsException and
 * the HttpExceptions the services throw (Forbidden, NotFound, BadRequest) —
 * carry messages written for the client and go out with a code. Anything else
 * (Prisma errors, TypeErrors) used to be echoed verbatim, leaking query
 * details and file paths; it is now logged with the user and event, and the
 * client only gets a generic INTERNAL_ERROR.
 */
@Catch()
export class WsErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ChatGateway');

  catch(exception: unknown, host: ArgumentsHost) {
    const ws = host.switchToWs();
    const client = ws.getClient<Socket & { userId?: string }>();

    if (exception instanceof WsException) {
      const error = exception.getError();
      const message = typeof error === 'string' ? error : 'Request rejected';
      client.emit('exception', { status: 'error', code: 'REQUEST_REJECTED', message });
      return;
    }

    if (exception instanceof HttpException) {
      client.emit('exception', {
        status: 'error',
        code: CODE_BY_STATUS[exception.getStatus()] ?? 'REQUEST_REJECTED',
        message: exception.message,
      });
      return;
    }

    const event = ws.getPattern();
    this.logger.error(
      `${event} failed for user ${client.userId ?? 'unknown'}: ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
      exception instanceof Error ? exception.stack : undefined,
    );
    client.emit('exception', {
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
}
