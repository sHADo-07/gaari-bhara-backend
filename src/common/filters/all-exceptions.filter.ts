import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { STATUS_CODES } from "http";
import { Request, Response } from "express";
import { QueryFailedError } from "typeorm";

/**
 * ONE error format for the whole API:
 * { statusCode, error, message, details?, path, timestamp }
 * Database rule violations (unique / foreign key / check / overlap) become clear 4xx errors, not 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") message = body;
      else {
        const b = body as Record<string, any>;
        message = Array.isArray(b.message) ? b.message.join(", ") : (b.message ?? exception.message);
        details = b.details;
      }
    } else if (exception instanceof QueryFailedError) {
      const code = (exception as any).driverError?.code ?? (exception as any).code;
      const constraint = (exception as any).driverError?.constraint ?? (exception as any).constraint;
      if (code === "23505") {
        statusCode = HttpStatus.CONFLICT;
        message = "This value already exists";
        details = constraint ? { constraint } : undefined;
      } else if (code === "23503") {
        statusCode = HttpStatus.BAD_REQUEST;
        message = "A related record does not exist, or it is still in use";
        details = constraint ? { constraint } : undefined;
      } else if (code === "23P01") {
        statusCode = HttpStatus.CONFLICT;
        message = "These dates overlap with another rent";
        details = constraint ? { constraint } : undefined;
      } else if (code === "23514" || code === "22P02") {
        statusCode = HttpStatus.BAD_REQUEST;
        message = "A value is not allowed by the database rules";
        details = constraint ? { constraint } : undefined;
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    } else {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    res.status(statusCode).json({
      statusCode,
      error: STATUS_CODES[statusCode] ?? "Error",
      message,
      ...(details !== undefined ? { details } : {}),
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
