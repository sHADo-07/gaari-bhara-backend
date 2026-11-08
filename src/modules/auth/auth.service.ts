import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { appConfig } from "@/config/app.config";
import { UsersService } from "@/modules/users/users.service";
import { UserStatus } from "@/modules/users/entities/user.entity";
import { PasswordService } from "@/modules/auth/password.service";
import { RevokedTokensService } from "@/modules/auth/revoked-tokens.service";
import { RegisterDto } from "@/modules/auth/dto/register.dto";
import { LoginDto } from "@/modules/auth/dto/login.dto";
import { ChangePasswordDto } from "@/modules/users/dto/change-password.dto";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { Role } from "@/common/enums/role.enum";

export interface TokenPayload {
  sub: string;
  role: Role;
  /** token version of the user when the token was issued */
  ver: number;
  jti: string;
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly revoked: RevokedTokensService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await this.passwords.hash(dto.password);
    const created = await this.users.create({
      role: dto.role,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
    });
    return {
      user: this.users.toOwnProfile(created),
      ...(await this.issueToken(created.id, created.role, created.tokenVersion)),
    };
  }

  async login(dto: LoginDto) {
    const found = await this.users.findByEmailWithPassword(dto.email);
    const ok = await this.passwords.verify(found?.passwordHash, dto.password);
    // Same answer for "no such email" and "wrong password".
    if (!found || !ok) throw new UnauthorizedException("Invalid email or password");
    if (found.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException("This account is suspended. Please contact an admin.");
    }
    await this.users.markLogin(found.id);
    return {
      user: this.users.toOwnProfile(found),
      ...(await this.issueToken(found.id, found.role, found.tokenVersion)),
    };
  }

  async logout(user: AuthUser) {
    if (user.tokenId && user.tokenExp) {
      await this.revoked.revoke(user.tokenId, user.id, user.tokenExp);
    }
    return { message: "Logged out" };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user || !(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException("Current password is wrong");
    }
    await this.users.setPassword(userId, await this.passwords.hash(dto.newPassword));
    return { message: "Password changed. Please log in again." };
  }

  /** Used by AuthGuard. Returns the signed-in user or throws 401. */
  async authenticateToken(token: string): Promise<AuthUser> {
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
    if (!payload.sub || !payload.jti) throw new UnauthorizedException("Invalid token");
    if (await this.revoked.isRevoked(payload.jti)) {
      throw new UnauthorizedException("This session was logged out. Please log in again.");
    }
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException("Invalid token");
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException("This account is suspended. Please contact an admin.");
    }
    if (payload.ver !== user.tokenVersion) {
      throw new UnauthorizedException("Your password was changed. Please log in again.");
    }
    return {
      id: user.id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
      tokenId: payload.jti,
      tokenExp: payload.exp,
    };
  }

  /** DEV ONLY (see ALLOW_TEST_USER_HEADER). Loads an existing active user by id. */
  async authenticateTestUser(userId: string): Promise<AuthUser> {
    const user = /^[0-9a-f-]{36}$/i.test(userId) ? await this.users.findById(userId) : null;
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("x-test-user-id does not match an active user");
    }
    return { id: user.id, role: user.role, email: user.email, fullName: user.fullName };
  }

  private async issueToken(userId: string, role: Role, ver: number) {
    const accessToken = await this.jwt.signAsync({ sub: userId, role, ver, jti: randomUUID() });
    return { accessToken, tokenType: "Bearer" as const, expiresIn: appConfig.env.JWT_TTL };
  }
}
