import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Length, Matches } from "class-validator";
import {
  BD_PHONE_REGEX,
  FULL_NAME_REGEX,
  normalizePhone,
  trim,
} from "@/common/validations/transforms";

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: "Rahim Uddin" })
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @Length(2, 80)
  @Matches(FULL_NAME_REGEX, { message: "fullName contains characters that are not allowed" })
  fullName?: string;

  @ApiPropertyOptional({ example: "01712345678", description: "Bangladeshi mobile number" })
  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(BD_PHONE_REGEX, { message: "phone must be a valid Bangladeshi mobile number" })
  phone?: string;
}
