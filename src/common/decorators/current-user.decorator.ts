import { getCurrentUser } from "@/common/helpers/auth.helper";
import { IRequest } from "@/common/interfaces/request.interface";
import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

/**
 * Use after AuthGuard:   me(@CurrentUser() user: AuthUser)
 * Throws 401 when nobody is signed in. (No debug logging: tokens and user data must not reach the console.)
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const req: IRequest = context.switchToHttp().getRequest();
    const user = getCurrentUser(req);
    if (!user) throw new UnauthorizedException("You are not authenticated");
    return user;
  },
);

/** Same, but returns null for visitors (for public routes that change a little when signed in). */
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const req: IRequest = context.switchToHttp().getRequest();
    return getCurrentUser(req);
  },
);
