import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'src/Client.js',
    plugins: [resolve(), commonjs()],
    output: [
        {
            file: 'dist/flora-client.esm.js',
            format: 'esm',
            sourcemap: true,
        },
        {
            file: 'dist/flora-client.cjs',
            format: 'cjs',
            sourcemap: true,
        },
        {
            file: 'dist/flora-client.umd.js',
            format: 'umd',
            name: 'FloraClient',
            sourcemap: true,
        },
    ],
};
