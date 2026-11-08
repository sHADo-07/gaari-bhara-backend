import { Role } from "@/common/enums/role.enum";

/** The signed-in user attached to req.user by AuthGuard. Safe to use in every module. */
export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  fullName: string;
  /** Token id and expiry (only when the request used a real token). */
  tokenId?: string;
  tokenExp?: number;
}
