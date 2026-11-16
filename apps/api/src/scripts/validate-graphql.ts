import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { buildASTSchema, validateSchema } from 'graphql';
import path from 'node:path';

const files = loadFilesSync(path.join(__dirname, '../graphql/schema/*.graphql'));
const schema = buildASTSchema(mergeTypeDefs(files));
const errors = validateSchema(schema);
if (errors.length) {
  for (const e of errors) console.error(e.message);
  process.exit(1);
}
const types = Object.keys(schema.getTypeMap()).filter((t) => !t.startsWith('__'));
console.log(`GraphQL schema OK: ${files.length} files, ${types.length} types`);
