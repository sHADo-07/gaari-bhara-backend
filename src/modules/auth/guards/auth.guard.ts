import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { IRequest } from "@/common/interfaces/request.interface";
import { AuthService } from "@/modules/auth/auth.service";
import { isTestUserHeaderAllowed } from "@/config/app.config";

/**
 * THE login check for every private route:  @UseGuards(AuthGuard)
 *
 * It really verifies the token (signature, expiry, logout list, suspended user,
 * password change) and puts the user in req.user.
 * (The old boilerplate guard returned true for any text. That bug is fixed here.)
 *
 * While the team builds, ALLOW_TEST_USER_HEADER=true lets a request use
 *   x-test-user-id: <uuid of a seeded user>
 * instead of a token. It is ignored in production.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: IRequest = context.switchToHttp().getRequest();
    const header = req.headers.authorization;

    if (header) {
      const [scheme, token] = header.split(" ");
      if (scheme?.toLowerCase() !== "bearer" || !token) {
        throw new UnauthorizedException("Use the header: Authorization: Bearer <token>");
      }
      req.user = await this.auth.authenticateToken(token);
      return true;
    }

    const testId = req.headers["x-test-user-id"];
    if (isTestUserHeaderAllowed() && typeof testId === "string") {
      req.user = await this.auth.authenticateTestUser(testId);
      return true;
    }

    throw new UnauthorizedException("You are not authenticated. Please log in.");
  }
}
