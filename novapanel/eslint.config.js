import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

export default [
	{
		ignores: ['.svelte-kit/**', 'build/**', 'coverage/**', 'node_modules/**', 'package-lock.json']
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2024,
				ParentNode: 'readonly',
				RequestInfo: 'readonly',
				RequestInit: 'readonly',
				RTCConfiguration: 'readonly',
				RTCIceCandidateInit: 'readonly'
			}
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
				extraFileExtensions: ['.svelte']
			}
		}
	},
	{
		files: ['**/*.{js,ts,svelte}'],
		rules: {
			'no-empty': 'off',
			'no-undef': 'error',
			'no-useless-assignment': 'off',
			'no-useless-escape': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'svelte/no-dupe-style-properties': 'off',
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/prefer-svelte-reactivity': 'off',
			'svelte/require-each-key': 'error',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					varsIgnorePattern: '^_'
				}
			]
		}
	}
];
