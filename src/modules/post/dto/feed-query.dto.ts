import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { trim } from "@/modules/post/dto/create-post.dto";
import {
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
  PostRentStatus,
  PostStatus,
  PostType,
} from "@/modules/post/posts.constants";
import { IsCalendarDate } from "@/modules/post/utils/calendar-date";

const toBool = ({ value }: { value: unknown }) =>
  value === "true" ? true : value === "false" ? false : value;

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @ApiPropertyOptional({ default: FEED_DEFAULT_LIMIT, minimum: 1, maximum: FEED_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FEED_MAX_LIMIT)
  limit: number = FEED_DEFAULT_LIMIT;
}

export class FeedQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @ApiPropertyOptional({ type: Number, description: "id from GET /categories" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({ type: Number, description: "id from GET /districts" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  districtId?: number;

  @ApiPropertyOptional({
    example: "2026-12-20",
    description: "Show posts whose date window overlaps [dateFrom, dateTo]. Posts with no dates count as flexible and are included.",
  })
  @IsOptional()
  @IsCalendarDate()
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-12-27" })
  @IsOptional()
  @IsCalendarDate()
  dateTo?: string;

  @ApiPropertyOptional({ description: "Minimum price per day, in poisha" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: "Maximum price per day, in poisha" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  withDriver?: boolean;

  @ApiPropertyOptional({ enum: PostRentStatus })
  @IsOptional()
  @IsEnum(PostRentStatus)
  rentStatus?: PostRentStatus;

  @ApiPropertyOptional({ description: "Keywords searched in title and body (max 5 words, all must match)", maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class MyPostsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PostStatus })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}

export class AdminPostsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PostStatus })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional({ enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;
}
