import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
}

/** Table "audit_logs" (owner: Sadat). Columns match migration 1730000000006. Rows are only added. */
@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: string;

  /** Who did it. Empty for actions before login (register, failed login is not logged). */
  @Column({ name: "user_id", type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ type: "enum", enum: AuditAction, enumName: "audit_action" })
  action!: AuditAction;

  /** First part of the route: users, auth, posts, rents ... */
  @Column({ type: "varchar", length: 60 })
  entity!: string;

  /** The id from the route (/rents/:id/...) or from the created record. */
  @Column({ name: "entity_id", type: "varchar", length: 64, nullable: true })
  entityId!: string | null;

  @Column({ name: "old_value", type: "jsonb", nullable: true })
  oldValue!: Record<string, unknown> | null;

  /** The request body, with passwords and tokens removed. */
  @Column({ name: "new_value", type: "jsonb", nullable: true })
  newValue!: Record<string, unknown> | null;

  @Column({ type: "varchar", length: 10 })
  method!: string;

  @Column({ type: "text" })
  path!: string;

  @Column({ name: "status_code", type: "smallint" })
  statusCode!: number;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip!: string | null;

  @Column({ name: "request_id", type: "varchar", length: 64, nullable: true })
  requestId!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
