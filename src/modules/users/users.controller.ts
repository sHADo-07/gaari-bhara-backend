import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@/modules/auth/guards/auth.guard";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { UsersService } from "@/modules/users/users.service";
import { UpdateProfileDto } from "@/modules/users/dto/update-profile.dto";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("users/me")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: "My profile" })
  async me(@CurrentUser() user: AuthUser) {
    const me = await this.users.findById(user.id);
    return this.users.toOwnProfile(me!);
  }

  @Patch()
  @ApiOperation({ summary: "Edit my name and phone" })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }
}
