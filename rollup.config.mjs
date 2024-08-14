import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const plugins = [resolve(), commonjs()];

export default [
    {
        input: 'build/node.js',
        output: {
            file: 'dist/flora-client.cjs',
            format: 'cjs',
            sourcemap: true,
        },
        plugins,
    },
    {
        input: 'build/browser.js',
        output: {
            file: 'dist/flora-client.umd.js',
            format: 'umd',
            name: 'FloraClient',
            sourcemap: true,
        },
        plugins,
    },
];
