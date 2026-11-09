import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
} from "class-validator";
import {
  Fuel,
  MAX_AREA_NOTE_LENGTH,
  MAX_PRICE_PER_DAY_POISHA,
  MAX_TITLE_LENGTH,
  PostType,
  Transmission,
} from "@/modules/post/posts.constants";
import { IsCalendarDate } from "@/modules/post/utils/calendar-date";

export const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return value;
};

export class CreatePostDto {
  @ApiProperty({
    enum: PostType,
    description: "Owner → OFFER, Renter → REQUEST",
  })
  @IsEnum(PostType)
  postType!: PostType;

  @ApiProperty({
    maxLength: MAX_TITLE_LENGTH,
    example: "Toyota Axio available for Eid week",
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title!: string;

  @ApiProperty({ maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;

  @ApiProperty({
    type: Number,
    example: 1,
    description: "id from GET /categories",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

  @ApiProperty({
    type: Number,
    example: 1,
    description: "id from GET /districts",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  districtId!: number;

  @ApiPropertyOptional({
    maxLength: MAX_AREA_NOTE_LENGTH,
    example: "Near Agrabad",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_AREA_NOTE_LENGTH)
  areaNote?: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  make?: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  model?: string;

  @ApiPropertyOptional({ minimum: 1950, maximum: 2100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  seats?: number;

  @ApiPropertyOptional({ enum: Transmission })
  @IsOptional()
  @IsEnum(Transmission)
  transmission?: Transmission;

  @ApiPropertyOptional({ enum: Fuel })
  @IsOptional()
  @IsEnum(Fuel)
  fuel?: Fuel;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  withDriver?: boolean;

  @ApiPropertyOptional({
    description:
      "Asking price per day in POISHA (1 taka = 100 poisha). Can be negotiated in chat.",
    example: 450000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_PER_DAY_POISHA)
  pricePerDay?: number;

  @ApiPropertyOptional({
    example: "2026-12-20",
    description: "YYYY-MM-DD",
  })
  @IsOptional()
  @IsCalendarDate()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: "2026-12-27",
    description: "YYYY-MM-DD, not before dateFrom",
  })
  @IsOptional()
  @IsCalendarDate()
  dateTo?: string;
}