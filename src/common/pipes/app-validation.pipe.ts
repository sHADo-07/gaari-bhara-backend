import { BadRequestException, ValidationError, ValidationPipe } from "@nestjs/common";

function flatten(errors: ValidationError[], parent = ""): { field: string; messages: string[] }[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = e.constraints ? [{ field, messages: Object.values(e.constraints) }] : [];
    const nested = e.children?.length ? flatten(e.children, field) : [];
    return [...own, ...nested];
  });
}

/**
 * One validation rule for ALL modules:
 *  - unknown fields are rejected (forbidNonWhitelisted)
 *  - types are converted by the DTO decorators (@Type, @Transform)
 *  - errors come back in the shared error format with a details list
 */
export const createAppValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException({ message: "Validation failed", details: flatten(errors) }),
  });
