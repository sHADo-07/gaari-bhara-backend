// One place to import from, for the other modules:
//   import { AuthGuard, RolesGuard, Roles, CurrentUser } from "@/modules/auth";
export { AuthGuard } from "@/modules/auth/guards/auth.guard";
export { RolesGuard } from "@/common/guard/roles.guard";
export { Roles } from "@/common/decorators/roles.decorator";
export { CurrentUser, OptionalCurrentUser } from "@/common/decorators/current-user.decorator";
export { Role } from "@/common/enums/role.enum";
export type { AuthUser } from "@/common/interfaces/auth-user.interface";
