import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { trim } from "@/modules/post/dto/create-post.dto";

export class HidePostDto {
  @ApiPropertyOptional({ maxLength: 300, description: "Why the admin hid the post. The author can see it." })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  reason?: string;
}
