import { GraphQLError, GraphQLScalarType, Kind } from 'graphql';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DateTimeScalar = new GraphQLScalarType<Date, string>({
  name: 'DateTime',
  serialize: (v) => (v instanceof Date ? v : new Date(String(v))).toISOString(),
  parseValue: (v) => {
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) throw new GraphQLError('Invalid DateTime');
    return d;
  },
  parseLiteral: (ast) => {
    if (ast.kind !== Kind.STRING) throw new GraphQLError('DateTime must be a string');
    return new Date(ast.value);
  },
});

/** Calendar date (no time). Stored as UTC midnight; serialized as YYYY-MM-DD. */
function parseDate(v: unknown): Date {
  if (typeof v !== 'string' || !DATE_RE.test(v)) throw new GraphQLError('Date must be YYYY-MM-DD');
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw new GraphQLError('Invalid date');
  return d;
}

export const DateScalar = new GraphQLScalarType<Date, string>({
  name: 'Date',
  serialize: (v) => (v instanceof Date ? v : new Date(String(v))).toISOString().slice(0, 10),
  parseValue: parseDate,
  parseLiteral: (ast) => parseDate(ast.kind === Kind.STRING ? ast.value : null),
});

export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  serialize: (v) => v,
  parseValue: (v) => v,
});
