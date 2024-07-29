import { build } from 'esbuild';

const entryPoints = [
  'api',
  'authorizer',
];

entryPoints.forEach((entryPoint) => {
  build({
    entryPoints: [`src/${entryPoint}/index.ts`],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: `dist/${entryPoint}/index.js`,
    external: ['aws-sdk'],
  }).catch(() => process.exit(1));
});
