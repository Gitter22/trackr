import { z, type ZodType } from 'zod';
import { badInput } from './errors';

/** Zod parse that turns the first issue into a BAD_USER_INPUT GraphQL error. */
export function parse<T extends ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join('.');
    throw badInput(field ? `${field}: ${issue.message}` : issue.message);
  }
  return result.data;
}
