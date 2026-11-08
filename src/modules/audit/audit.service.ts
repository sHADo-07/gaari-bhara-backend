import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLog } from "@/modules/audit/entities/audit-log.entity";
import { ListAuditQueryDto } from "@/modules/audit/dto/list-audit-query.dto";

/** Words that must never be stored in the audit log. */
const SECRET_KEY = /password|token|secret|authorization/i;

/** Copy of an object where passwords and tokens are replaced by "[hidden]". */
export function redact(value: unknown, depth = 0): any {
  if (value === null || typeof value !== "object") return value;
  if (depth > 5) return "[too deep]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? "[hidden]" : redact(v, depth + 1);
  }
  return out;
}

export type AuditEntry = Partial<Omit<AuditLog, "id" | "createdAt">> &
  Pick<AuditLog, "action" | "entity" | "method" | "path" | "statusCode">;

@Injectable()
export class AuditService {
  private readonly logger = new Logger("Audit");

  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  /**
   * Save one entry. It never throws: a problem in the audit log must not break the real request.
   * Other modules can call this to also save the OLD value, for example:
   *   await this.audit.record({ action: AuditAction.UPDATE, entity: "rents", ..., oldValue, newValue });
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.logs.insert({
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        oldValue: entry.oldValue ? redact(entry.oldValue) : null,
        newValue: entry.newValue ? redact(entry.newValue) : null,
        method: entry.method,
        path: entry.path,
        statusCode: entry.statusCode,
        ip: entry.ip ?? null,
        requestId: entry.requestId ?? null,
      });
    } catch (err) {
      this.logger.error(`Could not save audit entry: ${(err as Error).message}`);
    }
  }

  async list(q: ListAuditQueryDto) {
    const qb = this.logs.createQueryBuilder("a").orderBy("a.created_at", "DESC").addOrderBy("a.id", "DESC");
    if (q.userId) qb.andWhere("a.user_id = :userId", { userId: q.userId });
    if (q.entity) qb.andWhere("a.entity = :entity", { entity: q.entity });
    if (q.entityId) qb.andWhere("a.entity_id = :entityId", { entityId: q.entityId });
    if (q.action) qb.andWhere("a.action = :action", { action: q.action });
    if (q.from) qb.andWhere("a.created_at >= :from", { from: q.from });
    if (q.to) qb.andWhere("a.created_at <= :to", { to: q.to });
    qb.skip((q.page - 1) * q.limit).take(q.limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
    };
  }

  async getOne(id: string) {
    return this.logs.findOne({ where: { id } });
  }
}
