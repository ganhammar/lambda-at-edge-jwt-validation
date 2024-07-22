import { build } from 'esbuild';

const entryPoint = './src/authorizer/index.ts';

build({
  entryPoints: [entryPoint],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/authorizer/index.js',
  external: ['aws-sdk'],
}).catch(() => process.exit(1));