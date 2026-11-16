import { GraphQLError, Kind, type ASTVisitor, type SelectionSetNode, type ValidationContext } from 'graphql';

/**
 * Rejects queries nested deeper than `max` levels (fragments are followed).
 * DataLoaders batch each level, but a hostile deep query could still be huge.
 */
export function depthLimit(max: number) {
  return (context: ValidationContext): ASTVisitor => {
    const fragments = new Map(
      context
        .getDocument()
        .definitions.filter((d) => d.kind === Kind.FRAGMENT_DEFINITION)
        .map((d) => [d.name.value, d]),
    );
    const depthOf = (set: SelectionSetNode | undefined, seen: Set<string>): number => {
      if (!set) return 0;
      let deepest = 0;
      for (const sel of set.selections) {
        if (sel.kind === Kind.FIELD) {
          if (sel.name.value.startsWith('__')) continue;
          deepest = Math.max(deepest, sel.selectionSet ? 1 + depthOf(sel.selectionSet, seen) : 1);
        } else if (sel.kind === Kind.INLINE_FRAGMENT) {
          deepest = Math.max(deepest, depthOf(sel.selectionSet, seen));
        } else if (!seen.has(sel.name.value)) {
          const frag = fragments.get(sel.name.value);
          deepest = Math.max(deepest, depthOf(frag?.selectionSet, new Set([...seen, sel.name.value])));
        }
      }
      return deepest;
    };
    return {
      OperationDefinition(node) {
        const depth = depthOf(node.selectionSet, new Set());
        if (depth > max) {
          context.reportError(
            new GraphQLError(`Query is too deep (${depth} > ${max})`, {
              extensions: { code: 'QUERY_TOO_DEEP' },
            }),
          );
        }
      },
    };
  };
}
