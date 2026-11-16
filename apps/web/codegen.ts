import type { CodegenConfig } from '@graphql-codegen/cli';

/** Typed documents for every graphql(`...`) call in src, from the API's SDL. */
const config: CodegenConfig = {
  schema: '../api/src/graphql/schema/*.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/api/generated/**'],
  ignoreNoDocuments: true,
  generates: {
    'src/api/generated/': {
      preset: 'client',
      config: {
        enumsAsTypes: true,
        useTypeImports: true,
        scalars: { DateTime: 'string', Date: 'string', JSON: 'unknown' },
      },
      presetConfig: { fragmentMasking: false },
    },
  },
};

export default config;
