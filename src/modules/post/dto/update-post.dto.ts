import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { trim } from "@/modules/post/dto/create-post.dto";
import {
  Fuel,
  MAX_AREA_NOTE_LENGTH,
  MAX_PRICE_PER_DAY_POISHA,
  MAX_TITLE_LENGTH,
  Transmission,
} from "@/modules/post/posts.constants";
import { IsCalendarDate } from "@/modules/post/utils/calendar-date";

/**
 * PATCH body. Rules:
 *  - a field that is missing is left unchanged
 *  - required fields (title, body, categoryId, districtId) can be changed but never cleared
 *  - optional fields can be cleared by sending null
 *  - postType can never be changed (rejected as an unknown field)
 */
const present = (_: unknown, v: unknown) => v !== undefined;

export class UpdatePostDto {
  @ApiPropertyOptional({ maxLength: MAX_TITLE_LENGTH })
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body?: string;

  @ApiPropertyOptional({ type: Number })
  @ValidateIf(present)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({ type: Number })
  @ValidateIf(present)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  districtId?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_AREA_NOTE_LENGTH)
  areaNote?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  make?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  model?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  year?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  seats?: number | null;

  @ApiPropertyOptional({ enum: Transmission, nullable: true })
  @IsOptional()
  @IsEnum(Transmission)
  transmission?: Transmission | null;

  @ApiPropertyOptional({ enum: Fuel, nullable: true })
  @IsOptional()
  @IsEnum(Fuel)
  fuel?: Fuel | null;

  @ApiPropertyOptional()
  @ValidateIf(present)
  @IsBoolean()
  withDriver?: boolean;

  @ApiPropertyOptional({ nullable: true, description: "POISHA per day" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_PER_DAY_POISHA)
  pricePerDay?: number | null;

  @ApiPropertyOptional({ nullable: true, example: "2026-12-20" })
  @IsOptional()
  @IsCalendarDate()
  dateFrom?: string | null;

  @ApiPropertyOptional({ nullable: true, example: "2026-12-27" })
  @IsOptional()
  @IsCalendarDate()
  dateTo?: string | null;
}
