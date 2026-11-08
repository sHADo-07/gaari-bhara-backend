import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { RevokedToken } from "@/modules/auth/entities/revoked-token.entity";

@Injectable()
export class RevokedTokensService {
  constructor(@InjectRepository(RevokedToken) private readonly repo: Repository<RevokedToken>) {}

  async revoke(jti: string, userId: string, expiresAtSeconds: number) {
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ jti, userId, expiresAt: new Date(expiresAtSeconds * 1000) })
      .orIgnore()
      .execute();
    // Small clean-up: rows of tokens that have expired anyway are useless.
    await this.repo.delete({ expiresAt: LessThan(new Date()) });
  }

  isRevoked(jti: string) {
    return this.repo.exist({ where: { jti } });
  }
}
