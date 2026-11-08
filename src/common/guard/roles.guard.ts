import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import { IRequest } from "@/common/interfaces/request.interface";

/**
 * Checks @Roles(...) on a route. Always put it AFTER AuthGuard:
 *   @UseGuards(AuthGuard, RolesGuard)
 *   @Roles(Role.ADMIN)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req: IRequest = context.switchToHttp().getRequest();
    if (!req.user) throw new UnauthorizedException("You are not authenticated");
    if (!requiredRoles.includes(req.user.role)) {
      throw new ForbiddenException("You do not have permission to do this");
    }
    return true;
  }
}
