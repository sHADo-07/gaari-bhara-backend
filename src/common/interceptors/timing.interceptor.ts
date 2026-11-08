import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Response } from "express";
import { Observable, tap } from "rxjs";

/** Slow answers are reported in the log (target in our report: lists answer within 500 ms). */
const SLOW_MS = 500;

/**
 * Bonus: Interceptor.
 * Measures how long the route handler took and sends it back in the header X-Response-Time.
 * A handler slower than 500 ms is also written to the log as a warning.
 */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("Timing");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const http = context.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest();
    const started = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        if (!res.headersSent) res.setHeader("X-Response-Time", `${ms.toFixed(1)}ms`);
        if (ms > SLOW_MS) this.logger.warn(`Slow route: ${req.method} ${req.path} took ${ms.toFixed(0)}ms`);
      }),
    );
  }
}
