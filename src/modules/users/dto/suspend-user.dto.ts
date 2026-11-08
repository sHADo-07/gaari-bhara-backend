import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { trim } from "@/common/validations/transforms";

export class SuspendUserDto {
  @ApiPropertyOptional({ example: "Fake listings reported many times" })
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}
