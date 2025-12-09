import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default defineConfig([
    js.configs.recommended,
    eslintPluginPrettierRecommended,
    {
        ignores: ['dist/', 'node_modules/', 'package.json'],
    },
    {
        files: ['src/**/*.js', 'test/**/*.js'],

        languageOptions: {
            sourceType: 'module',
            globals: {
                AbortSignal: 'readable',
                Blob: 'readable',
                fetch: 'readable',
                Headers: 'readable',
                Request: 'readable',
                URL: 'readable',
                URLSearchParams: 'readable',
                window: 'readable',
            },
            parserOptions: {
                ecmaVersion: 2020,
            },
        },

        rules: {
            indent: ['error', 4],
        },
    },
]);
