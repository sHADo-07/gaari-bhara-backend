/** The three user types of Gaari Bhara. Values match the PostgreSQL enum "user_role". */
export enum Role {
  RENTER = "RENTER",
  OWNER = "OWNER",
  ADMIN = "ADMIN",
}

/** Roles a person may choose on the public sign-up page. Admin is created by the team only. */
export const SIGNUP_ROLES: Role[] = [Role.RENTER, Role.OWNER];
