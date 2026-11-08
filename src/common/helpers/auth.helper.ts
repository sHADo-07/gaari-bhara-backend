import { IRequest } from "@/common/interfaces/request.interface";
import { AuthUser } from "@/common/interfaces/auth-user.interface";

/** Returns the signed-in user or null. */
export const getCurrentUser = (req: IRequest): AuthUser | null => {
  if (!req.user || !req.user.id) return null;
  return req.user;
};
