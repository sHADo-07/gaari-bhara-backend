import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@/modules/auth/guards/auth.guard";
import { RolesGuard } from "@/common/guard/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Role } from "@/common/enums/role.enum";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { UsersService } from "@/modules/users/users.service";
import { ListUsersQueryDto } from "@/modules/users/dto/list-users-query.dto";
import { SuspendUserDto } from "@/modules/users/dto/suspend-user.dto";

@ApiTags("Admin: users")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: "List users (filters: role, status, q; pages)" })
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Patch(":id/suspend")
  @ApiOperation({ summary: "Suspend a user. Their tokens stop working at once." })
  suspend(
    @CurrentUser() admin: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SuspendUserDto,
  ) {
    return this.users.suspend(admin.id, id, dto.reason);
  }

  @Patch(":id/restore")
  @ApiOperation({ summary: "Restore a suspended user" })
  restore(@Param("id", ParseUUIDPipe) id: string) {
    return this.users.restore(id);
  }
}
