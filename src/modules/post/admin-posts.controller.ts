import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import { AuthGuard } from "@/modules/auth/guards/auth.guard";
import { RolesGuard } from "@/common/guard/roles.guard";
import { HidePostDto } from "@/modules/post/dto/hide-post.dto";
import { AdminPostsQueryDto } from "@/modules/post/dto/feed-query.dto";
import { PostsService } from "@/modules/post/posts.service";

/** Admin only: AuthGuard checks the login, RolesGuard checks @Roles(Role.ADMIN). */
@ApiTags("Admin – Posts")
@ApiBearerAuth()
@Controller("admin/posts")
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @ApiOperation({ summary: "Admin: list posts of any status" })
  list(@Query() query: AdminPostsQueryDto) {
    return this.posts.adminList(query);
  }

  @Patch(":id/hide")
  @HttpCode(200)
  @ApiOperation({ summary: "Admin: hide a post (ACTIVE or CLOSED → HIDDEN). Repeat-safe." })
  hide(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: HidePostDto) {
    return this.posts.hide(id, dto.reason);
  }

  @Patch(":id/unhide")
  @HttpCode(200)
  @ApiOperation({ summary: "Admin: restore a hidden post to the status it had before. Repeat-safe." })
  unhide(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.posts.unhide(id);
  }
}
