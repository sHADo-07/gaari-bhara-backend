import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { AuditAction } from "@/modules/audit/entities/audit-log.entity";
import { trim } from "@/common/validations/transforms";

export class ListAuditQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: "Who did it (user id)" })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: "users", description: "users, auth, posts, rents ..." })
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(60)
  entity?: string;

  @ApiPropertyOptional({ description: "Id of the changed record" })
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ example: "2026-11-01T00:00:00Z" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-11-30T23:59:59Z" })
  @IsOptional()
  @IsDateString()
  to?: string;
}
