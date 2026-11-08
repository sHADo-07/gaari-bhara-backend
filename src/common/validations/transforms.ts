/** Small helpers used inside DTO @Transform(...) so every module cleans input the same way. */

export const trim = (value: unknown) => (typeof value === "string" ? value.trim() : value);

export const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

/**
 * Bangladeshi mobile numbers are saved as 01XXXXXXXXX.
 * "+8801712345678", "8801712345678" and "017-1234 5678" all become "01712345678".
 */
export const normalizePhone = (value: unknown) => {
  if (typeof value !== "string") return value;
  let v = value.replace(/[\s-]/g, "");
  if (v.startsWith("+88")) v = v.slice(3);
  else if (v.startsWith("88") && v.length === 13) v = v.slice(2);
  return v;
};

export const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;
/** At least one letter and one digit. */
export const PASSWORD_REGEX = /^(?=.*\p{L})(?=.*\d).+$/u;
export const FULL_NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u;
