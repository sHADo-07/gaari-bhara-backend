import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import { NextFunction, Response } from "express";
import { IRequest } from "@/common/interfaces/request.interface";

/**
 * Runs before every route (bonus: Middleware).
 * 1. Gives every request an id (header X-Request-Id), so one request can be followed in the log.
 * 2. Writes ONE log line when the response is finished: method, path, status, time, request id.
 *    No headers, no body, no token are ever logged.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: IRequest, res: Response, next: NextFunction) {
    const incoming = req.headers["x-request-id"];
    const id =
      typeof incoming === "string" && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    req.request_id = id;
    req.start_at = Date.now();
    res.setHeader("X-Request-Id", id);

    res.on("finish", () => {
      if (process.env.NODE_ENV === "test") return; // keep test output clean
      const ms = Date.now() - (req.start_at ?? Date.now());
      const path = req.originalUrl.split("?")[0];
      const line = `${req.method} ${path} ${res.statusCode} ${ms}ms [${id}]`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    next();
  }
}
