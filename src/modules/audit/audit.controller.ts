import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@/modules/auth/guards/auth.guard";
import { RolesGuard } from "@/common/guard/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import { AuditService } from "@/modules/audit/audit.service";
import { ListAuditQueryDto } from "@/modules/audit/dto/list-audit-query.dto";

@ApiTags("Admin: audit log")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("admin/audit-logs")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: "List audit entries (filters: userId, entity, entityId, action, from, to; pages)" })
  list(@Query() query: ListAuditQueryDto) {
    return this.audit.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one audit entry" })
  async getOne(@Param("id", ParseIntPipe) id: number) {
    const entry = await this.audit.getOne(String(id));
    if (!entry) throw new NotFoundException("Audit entry not found");
    return entry;
  }
}
