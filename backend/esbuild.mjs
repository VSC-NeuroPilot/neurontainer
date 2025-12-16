import * as esbuild from 'esbuild'
//@ts-check

/**
 * @type {import('esbuild').Plugin}
 */
export const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',

    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd(result => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                if (location == null) return;
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.log('[watch] build finished');
        });
    },
};


const isProd = process.argv.includes('--prod')

const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/index.js',
  sourcemap: !isProd,
  minify: isProd,
  external: [
    '@docker/node-sdk',
    'neuro-game-sdk',
    'hono',
    'jsonschema',
    'winston',
    'winston-transport'
  ],
  logLevel: 'info',
  plugins: [esbuildProblemMatcherPlugin]
})

if (process.argv.includes('--watch')) {
  await ctx.watch()
  console.log('Watching for changes...')
} else {
  await ctx.rebuild()
  await ctx.dispose()
}