import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, mergeMap } from "rxjs";
import { IRequest } from "@/common/interfaces/request.interface";
import { AuditService } from "@/modules/audit/audit.service";
import { AuditAction } from "@/modules/audit/entities/audit-log.entity";

const ACTION_BY_METHOD: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

/**
 * Bonus: Audit log (written by an Interceptor).
 * After every SUCCESSFUL POST, PUT, PATCH and DELETE it saves who did it, what it was,
 * the request body (passwords and tokens removed), the IP, and the time.
 * GET requests are not logged. It works for every module, nobody has to call it.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<IRequest>();
    const action = ACTION_BY_METHOD[req.method];
    if (!action) return next.handle();

    return next.handle().pipe(
      mergeMap(async (result) => {
        const res = http.getResponse();
        const path = req.originalUrl.split("?")[0];
        const segments = path.split("/").filter(Boolean).filter((s) => s !== "admin");
        const body = req.body && typeof req.body === "object" && Object.keys(req.body).length ? req.body : null;
        const created = result && typeof result === "object" ? (result as Record<string, any>) : {};

        await this.audit.record({
          userId: req.user?.id ?? created.user?.id ?? null,
          action,
          entity: (segments[0] ?? "unknown").slice(0, 60),
          entityId: (req.params?.id ?? created.id ?? null)?.toString().slice(0, 64) ?? null,
          newValue: body,
          method: req.method,
          path,
          statusCode: res.statusCode,
          ip: (req.ip ?? null)?.slice(0, 64) ?? null,
          requestId: req.request_id ?? null,
        });
        return result;
      }),
    );
  }
}
