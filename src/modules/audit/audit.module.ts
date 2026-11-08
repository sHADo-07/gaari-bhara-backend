import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLog } from "@/modules/audit/entities/audit-log.entity";
import { AuditService } from "@/modules/audit/audit.service";
import { AuditInterceptor } from "@/modules/audit/audit.interceptor";
import { AuditController } from "@/modules/audit/audit.controller";

/** Bonus: audit log. The interceptor is global, so every module is covered without any change. */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}
