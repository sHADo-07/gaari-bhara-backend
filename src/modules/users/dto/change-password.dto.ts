import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";
import { PASSWORD_REGEX } from "@/common/validations/transforms";

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ description: "8 to 128 characters, with at least one letter and one digit" })
  @IsString()
  @Length(8, 128)
  @Matches(PASSWORD_REGEX, { message: "newPassword must contain at least one letter and one digit" })
  newPassword!: string;
}
