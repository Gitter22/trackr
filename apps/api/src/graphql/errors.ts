import { GraphQLError } from 'graphql';

const err = (code: string, message: string) => new GraphQLError(message, { extensions: { code } });

export const notFound = (what = 'Not found') => err('NOT_FOUND', what);
export const forbidden = (message = 'Not allowed') => err('FORBIDDEN', message);
export const badInput = (message: string) => err('BAD_USER_INPUT', message);
export const conflict = (message: string) => err('CONFLICT', message);
