import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsString, Length, Matches, MaxLength } from "class-validator";
import { Role, SIGNUP_ROLES } from "@/common/enums/role.enum";
import {
  BD_PHONE_REGEX,
  FULL_NAME_REGEX,
  PASSWORD_REGEX,
  normalizeEmail,
  normalizePhone,
  trim,
} from "@/common/validations/transforms";

export class RegisterDto {
  @ApiProperty({ example: "Rahim Uddin" })
  @Transform(({ value }) => trim(value))
  @IsString()
  @Length(2, 80)
  @Matches(FULL_NAME_REGEX, { message: "fullName contains characters that are not allowed" })
  fullName!: string;

  @ApiProperty({ example: "rahim@example.com" })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: "email must be a valid email address" })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: "01712345678", description: "Bangladeshi mobile number (+88 is accepted)" })
  @Transform(({ value }) => normalizePhone(value))
  @Matches(BD_PHONE_REGEX, { message: "phone must be a valid Bangladeshi mobile number" })
  phone!: string;

  @ApiProperty({ description: "8 to 128 characters, with at least one letter and one digit" })
  @IsString()
  @Length(8, 128)
  @Matches(PASSWORD_REGEX, { message: "password must contain at least one letter and one digit" })
  password!: string;

  @ApiProperty({ enum: SIGNUP_ROLES, example: Role.RENTER, description: "Admin cannot be chosen here" })
  @IsIn(SIGNUP_ROLES, { message: "role must be RENTER or OWNER" })
  role!: Role;
}
