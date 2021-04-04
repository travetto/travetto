"use strict";
Object.defineProperty(exports, 'ᚕtrv', { configurable: true, value: true });
module.exports = {
    env: {
        es6: true,
        node: true
    },
    parser: '@typescript-eslint/parser',
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    plugins: [
        '@typescript-eslint'
    ],
    globals: { $argv: 'readonly', $exec: 'readonly' },
    rules: {
        '@typescript-eslint/array-type': 'error',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-member-accessibility': ['off', { accessibility: 'explicit' }],
        indent: 'off',
        '@typescript-eslint/indent': ['error', 2],
        '@typescript-eslint/member-delimiter-style': ['error', {
                multiline: { delimiter: 'semi', requireLast: true },
                singleline: { delimiter: 'comma', requireLast: false }
            }],
        '@typescript-eslint/no-use-before-define': ['error', { classes: false }],
        '@typescript-eslint/member-ordering': ['error', {
                default: [
                    'private-static-field',
                    'protected-static-field',
                    'public-static-field',
                    'private-static-method',
                    'protected-static-method',
                    'public-static-method',
                    'private-instance-field',
                    'protected-instance-field',
                    'public-instance-field',
                    'private-constructor',
                    'protected-constructor',
                    'public-constructor',
                    'private-instance-method',
                    'protected-instance-method',
                    'public-instance-method'
                ]
            }],
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-for-in-array': 'error',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-this-alias': 'error',
        'require-atomic-updates': ['off'],
        '@typescript-eslint/no-unused-vars': ['error', {
                varsIgnorePattern: '^(__|[A-Z])[A-Za-z0-9]*',
                args: 'none'
            }],
        '@typescript-eslint/quotes': ['error', 'single', {
                avoidEscape: true,
                allowTemplateLiterals: false
            }],
        '@typescript-eslint/semi': ['error', 'always'],
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/triple-slash-reference': 'off',
        '@typescript-eslint/interface-name-prefix': 'off',
        'no-case-declarations': ['error'],
        'no-ex-assign': ['off'],
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/type-annotation-spacing': 'error',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        'arrow-body-style': ['error', 'as-needed'],
        '@typescript-eslint/naming-convention': [
            'error',
            { selector: 'default', format: ['camelCase'] },
            { selector: 'parameter', format: [], filter: { regex: '^__', match: true } },
            { selector: 'variable', format: [], filter: { regex: '^__', match: true } },
            { selector: 'property', format: ['camelCase', 'UPPER_CASE', 'PascalCase', 'snake_case'], leadingUnderscore: 'allow' },
            { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
            { selector: 'method', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
            { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
            { selector: 'typeLike', format: ['PascalCase'] },
            { selector: 'function', format: ['PascalCase', 'camelCase'] }
        ],
        curly: 'error',
        'dot-notation': 'off',
        eqeqeq: ['error', 'smart'],
        'guard-for-in': 'error',
        'id-match': 'error',
        'max-len': ['error', { code: 180 }],
        'new-parens': 'error',
        'no-bitwise': 'error',
        'no-caller': 'error',
        'no-console': [
            'error',
            { allow: ['log', 'warn', 'trace', 'debug', 'info', 'error', 'Console', 'profile', 'profileEnd'] }
        ],
        'no-extra-boolean-cast': 'off',
        'no-prototype-builtins': 'off',
        'no-debugger': 'error',
        'no-duplicate-imports': 'error',
        'no-empty': 'off',
        'no-eval': 'error',
        'no-fallthrough': 'error',
        'no-invalid-this': ['off'],
        'no-irregular-whitespace': 'error',
        'no-multiple-empty-lines': 'error',
        'no-new-wrappers': 'error',
        'no-redeclare': 'off',
        '@typescript-eslint/no-redeclare': 'error',
        'no-shadow': ['error', { hoist: 'all' }],
        'no-sparse-arrays': 'error',
        'no-template-curly-in-string': 'error',
        'no-throw-literal': 'error',
        'no-trailing-spaces': 'error',
        'no-underscore-dangle': ['off'],
        'no-useless-escape': ['off'],
        'no-unused-expressions': 'off',
        'no-unused-labels': 'error',
        'no-var': 'error',
        'object-shorthand': 'error',
        'prefer-const': 'error',
        'prefer-object-spread': 'error',
        'prefer-template': 'error',
        'quote-props': ['error', 'as-needed'],
        radix: 'error',
        'spaced-comment': ['error', 'always', { line: { markers: ['/'] } }]
    },
    overrides: [{
            files: ['doc.ts'],
            rules: {
                'max-len': 'off',
                '@typescript-eslint/indent': 'off'
            }
        }]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29yZS5qcyIsInNvdXJjZVJvb3QiOiIvaG9tZS90aW0vQ29kZS90cmF2ZXR0by8iLCJzb3VyY2VzIjpbImJpbi9lc2xpbnQvY29yZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBK0lBLE1BQU0sQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUEvSTVFLGlCQUFTO0lBQ1AsR0FBRyxFQUFFO1FBQ0gsR0FBRyxFQUFFLElBQUk7UUFDVCxJQUFJLEVBQUUsSUFBSTtLQUNYO0lBQ0QsTUFBTSxFQUFFLDJCQUEyQjtJQUNuQyxPQUFPLEVBQUU7UUFDUCxvQkFBb0I7UUFDcEIsdUNBQXVDO0tBQ3hDO0lBQ0QsT0FBTyxFQUFFO1FBQ1Asb0JBQW9CO0tBQ3JCO0lBQ0QsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFO0lBQ2pELEtBQUssRUFBRTtRQUNMLCtCQUErQixFQUFFLE9BQU87UUFDeEMsa0RBQWtELEVBQUUsS0FBSztRQUN6RCwwQ0FBMEMsRUFBRSxLQUFLO1FBQ2pELG9DQUFvQyxFQUFFLE1BQU07UUFDNUMsa0RBQWtELEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxhQUFhLEVBQUUsVUFBVSxFQUFFLENBQUM7UUFDMUYsTUFBTSxFQUFFLEtBQUs7UUFDYiwyQkFBMkIsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDekMsMkNBQTJDLEVBQUUsQ0FBQyxPQUFPLEVBQUU7Z0JBQ3JELFNBQVMsRUFBRSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRTtnQkFDbkQsVUFBVSxFQUFFLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFO2FBQ3ZELENBQUM7UUFDRix5Q0FBeUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztRQUN4RSxvQ0FBb0MsRUFBRSxDQUFDLE9BQU8sRUFBRTtnQkFDOUMsT0FBTyxFQUFFO29CQUVQLHNCQUFzQjtvQkFDdEIsd0JBQXdCO29CQUN4QixxQkFBcUI7b0JBRXJCLHVCQUF1QjtvQkFDdkIseUJBQXlCO29CQUN6QixzQkFBc0I7b0JBRXRCLHdCQUF3QjtvQkFDeEIsMEJBQTBCO29CQUMxQix1QkFBdUI7b0JBR3ZCLHFCQUFxQjtvQkFDckIsdUJBQXVCO29CQUN2QixvQkFBb0I7b0JBR3BCLHlCQUF5QjtvQkFDekIsMkJBQTJCO29CQUMzQix3QkFBd0I7aUJBQ3pCO2FBQ0YsQ0FBQztRQUNGLG9DQUFvQyxFQUFFLEtBQUs7UUFDM0Msc0NBQXNDLEVBQUUsS0FBSztRQUM3QyxvQ0FBb0MsRUFBRSxPQUFPO1FBQzdDLHdDQUF3QyxFQUFFLEtBQUs7UUFDL0Msa0NBQWtDLEVBQUUsT0FBTztRQUMzQyx3QkFBd0IsRUFBRSxDQUFDLEtBQUssQ0FBQztRQUNqQyxtQ0FBbUMsRUFBRSxDQUFDLE9BQU8sRUFBRTtnQkFDN0MsaUJBQWlCLEVBQUUseUJBQXlCO2dCQUM1QyxJQUFJLEVBQUUsTUFBTTthQUNiLENBQUM7UUFDRiwyQkFBMkIsRUFBRSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUU7Z0JBQy9DLFdBQVcsRUFBRSxJQUFJO2dCQUNqQixxQkFBcUIsRUFBRSxLQUFLO2FBQzdCLENBQUM7UUFDRix5QkFBeUIsRUFBRSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUM7UUFDOUMsdUNBQXVDLEVBQUUsS0FBSztRQUM5QywyQ0FBMkMsRUFBRSxLQUFLO1FBQ2xELDBDQUEwQyxFQUFFLEtBQUs7UUFDakQsc0JBQXNCLEVBQUUsQ0FBQyxPQUFPLENBQUM7UUFDakMsY0FBYyxFQUFFLENBQUMsS0FBSyxDQUFDO1FBQ3ZCLDhCQUE4QixFQUFFLEtBQUs7UUFDckMsbUNBQW1DLEVBQUUsS0FBSztRQUMxQyw0Q0FBNEMsRUFBRSxPQUFPO1FBQ3JELG1EQUFtRCxFQUFFLEtBQUs7UUFDMUQsa0JBQWtCLEVBQUUsQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDO1FBQzFDLHNDQUFzQyxFQUFFO1lBQ3RDLE9BQU87WUFDUCxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDOUMsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7WUFDNUUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7WUFDM0UsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxDQUFDLFdBQVcsRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQyxFQUFFLGlCQUFpQixFQUFFLE9BQU8sRUFBRTtZQUNySCxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLENBQUMsV0FBVyxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxPQUFPLEVBQUU7WUFDdkcsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxDQUFDLFdBQVcsRUFBRSxZQUFZLEVBQUUsWUFBWSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsT0FBTyxFQUFFO1lBQ3JHLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsQ0FBQyxXQUFXLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxPQUFPLEVBQUU7WUFDNUUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQ2hELEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLEVBQUU7U0FDOUQ7UUFDRCxLQUFLLEVBQUUsT0FBTztRQUNkLGNBQWMsRUFBRSxLQUFLO1FBQ3JCLE1BQU0sRUFBRSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUM7UUFDMUIsY0FBYyxFQUFFLE9BQU87UUFDdkIsVUFBVSxFQUFFLE9BQU87UUFDbkIsU0FBUyxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ25DLFlBQVksRUFBRSxPQUFPO1FBQ3JCLFlBQVksRUFBRSxPQUFPO1FBQ3JCLFdBQVcsRUFBRSxPQUFPO1FBQ3BCLFlBQVksRUFBRTtZQUNaLE9BQU87WUFDUCxFQUFFLEtBQUssRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsWUFBWSxDQUFDLEVBQUU7U0FDbEc7UUFDRCx1QkFBdUIsRUFBRSxLQUFLO1FBQzlCLHVCQUF1QixFQUFFLEtBQUs7UUFDOUIsYUFBYSxFQUFFLE9BQU87UUFDdEIsc0JBQXNCLEVBQUUsT0FBTztRQUMvQixVQUFVLEVBQUUsS0FBSztRQUNqQixTQUFTLEVBQUUsT0FBTztRQUNsQixnQkFBZ0IsRUFBRSxPQUFPO1FBQ3pCLGlCQUFpQixFQUFFLENBQUMsS0FBSyxDQUFDO1FBQzFCLHlCQUF5QixFQUFFLE9BQU87UUFDbEMseUJBQXlCLEVBQUUsT0FBTztRQUNsQyxpQkFBaUIsRUFBRSxPQUFPO1FBQzFCLGNBQWMsRUFBRSxLQUFLO1FBQ3JCLGlDQUFpQyxFQUFFLE9BQU87UUFDMUMsV0FBVyxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxDQUFDO1FBQ3hDLGtCQUFrQixFQUFFLE9BQU87UUFDM0IsNkJBQTZCLEVBQUUsT0FBTztRQUN0QyxrQkFBa0IsRUFBRSxPQUFPO1FBQzNCLG9CQUFvQixFQUFFLE9BQU87UUFDN0Isc0JBQXNCLEVBQUUsQ0FBQyxLQUFLLENBQUM7UUFDL0IsbUJBQW1CLEVBQUUsQ0FBQyxLQUFLLENBQUM7UUFDNUIsdUJBQXVCLEVBQUUsS0FBSztRQUM5QixrQkFBa0IsRUFBRSxPQUFPO1FBQzNCLFFBQVEsRUFBRSxPQUFPO1FBQ2pCLGtCQUFrQixFQUFFLE9BQU87UUFDM0IsY0FBYyxFQUFFLE9BQU87UUFDdkIsc0JBQXNCLEVBQUUsT0FBTztRQUMvQixpQkFBaUIsRUFBRSxPQUFPO1FBQzFCLGFBQWEsRUFBRSxDQUFDLE9BQU8sRUFBRSxXQUFXLENBQUM7UUFDckMsS0FBSyxFQUFFLE9BQU87UUFDZCxnQkFBZ0IsRUFBRSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUM7S0FDcEU7SUFDRCxTQUFTLEVBQUUsQ0FBQztZQUNWLEtBQUssRUFBRSxDQUFDLFFBQVEsQ0FBQztZQUNqQixLQUFLLEVBQUU7Z0JBQ0wsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLDJCQUEyQixFQUFFLEtBQUs7YUFDbkM7U0FDRixDQUFDO0NBQ0gsQ0FBQyJ9