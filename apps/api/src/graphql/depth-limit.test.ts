import { buildSchema, parse, validate } from 'graphql';
import { describe, expect, it } from 'vitest';
import { depthLimit } from './depth-limit';

const schema = buildSchema(`type Node { id: ID! child: Node } type Query { node: Node }`);
const nested = (levels: number) =>
  `{ node ${'{ child '.repeat(levels - 1)}{ id }${' }'.repeat(levels - 1)} }`;
const errorsFor = (query: string, max: number) => validate(schema, parse(query), [depthLimit(max)]);

describe('depthLimit', () => {
  it('allows queries up to the limit', () => {
    expect(errorsFor(nested(3), 4)).toHaveLength(0);
  });
  it('rejects deeper queries, also through fragments', () => {
    expect(errorsFor(nested(5), 4)[0].message).toMatch(/too deep/);
    const viaFragment = `fragment F on Node { child { child { child { id } } } } { node { child { ...F } } }`;
    expect(errorsFor(viaFragment, 4)).toHaveLength(1);
  });
  it('ignores introspection fields', () => {
    expect(errorsFor('{ __schema { types { fields { type { name } } } } }', 2)).toHaveLength(0);
  });
});
