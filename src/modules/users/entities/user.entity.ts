import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Role } from "@/common/enums/role.enum";

export enum UserStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

/** Table "users" (owner: Sadat). Columns match migration 1730000000001. */
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "enum", enum: Role, enumName: "user_role" })
  role!: Role;

  @Column({ name: "full_name", type: "varchar", length: 80 })
  fullName!: string;

  /** Always saved in lower case (also enforced by a database rule). */
  @Column({ type: "varchar", length: 254, unique: true })
  email!: string;

  /** Always saved as 01XXXXXXXXX. */
  @Column({ type: "varchar", length: 11, unique: true })
  phone!: string;

  @Column({ name: "password_hash", type: "text", select: false })
  passwordHash!: string;

  @Column({ type: "enum", enum: UserStatus, enumName: "user_status", default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ name: "email_verified_at", type: "timestamptz", nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: "password_changed_at", type: "timestamptz", nullable: true })
  passwordChangedAt!: Date | null;

  /** Goes up by 1 when the password changes. Tokens with an older number stop working. */
  @Column({ name: "token_version", type: "integer", default: 0 })
  tokenVersion!: number;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: "suspended_reason", type: "text", nullable: true })
  suspendedReason!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
