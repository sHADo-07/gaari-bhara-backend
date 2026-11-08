import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

/** Tokens that were logged out. A row is only needed until the token would have expired anyway. */
@Entity("revoked_tokens")
export class RevokedToken {
  @PrimaryColumn({ type: "uuid" })
  jti!: string;

  @Column({ name: "user_id", type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @CreateDateColumn({ name: "revoked_at", type: "timestamptz" })
  revokedAt!: Date;
}
