import { defineConfig } from 'rolldown';
import pkg from './package.json' with { type: 'json' };

export default defineConfig((c) => ({
    input: 'src/index.ts',
    output: {
        file: 'dist/index.js',
        minify: !c.watch,
        sourcemap: c.watch,
    },
    tsconfig: './tsconfig.json',
    external: Object.keys(pkg.dependencies),
    platform: 'node'
}))
