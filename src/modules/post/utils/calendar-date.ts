import { registerDecorator, ValidationOptions } from "class-validator";

/** True only for real calendar dates written as YYYY-MM-DD (rejects 2026-02-30, "tomorrow", etc.). */
export function isCalendarDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 1900 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function IsCalendarDate(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isCalendarDate",
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a real date in YYYY-MM-DD format`,
        ...options,
      },
      validator: { validate: isCalendarDate },
    });
}
