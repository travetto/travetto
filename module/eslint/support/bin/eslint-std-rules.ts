import type { Linter } from 'eslint';

export const STD_RULES: Linter.Config['rules'] = {
  'no-loss-of-precision': 0,
  'no-unused-vars': 0,
  'no-dupe-class-members': 0,
  '@typescript-eslint/array-type': 'error',
  '@typescript-eslint/explicit-function-return-type': 0,
  '@typescript-eslint/no-non-null-assertion': 0,
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/parameter-properties': 'error',
  '@typescript-eslint/explicit-member-accessibility': [0, { accessibility: 'explicit' }],
  indent: 0,
  '@stylistic/indent': [
    'error',
    2,
    {
      ignoredNodes: [
        'PropertyDefinition[decorators]',
        'TSUnionType',
        'TSTypeParameterInstantiation',
        'FunctionExpression > .params[decorators.length > 0]',
        'FunctionExpression > .params > :matches(Decorator, :not(:first-child))',
        'ClassBody.body > PropertyDefinition[decorators.length > 0] > .key'
      ],
      SwitchCase: 1
    }
  ],
  '@stylistic/member-delimiter-style': [
    'error',
    {
      multiline: { delimiter: 'semi', requireLast: true },
      singleline: { delimiter: 'comma', requireLast: false }
    }
  ],
  'no-restricted-imports': ['error', { paths: ['typescript'] }],
  '@typescript-eslint/no-use-before-define': ['error', { classes: false }],
  '@typescript-eslint/member-ordering': [
    'error',
    {
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
    }
  ],
  '@typescript-eslint/no-var-requires': 0,
  '@typescript-eslint/no-empty-function': 0,
  '@typescript-eslint/no-for-in-array': 'error',
  '@typescript-eslint/no-inferrable-types': 0,
  '@typescript-eslint/no-this-alias': 'error',
  'require-atomic-updates': 0,
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      varsIgnorePattern: '^(_|[A-Z])[A-Za-z0-9]*',
      argsIgnorePattern: '^_',
      args: 'after-used'
    }
  ],
  '@stylistic/quotes': [
    'error',
    'single',
    { avoidEscape: true, allowTemplateLiterals: 'never' }
  ],
  '@stylistic/semi': [
    'error',
    'always'
  ],
  '@typescript-eslint/no-empty-interface': 0,
  '@typescript-eslint/triple-slash-reference': 0,
  '@typescript-eslint/interface-name-prefix': 0,
  'no-case-declarations': [
    'error'
  ],
  'no-ex-assign': 0,
  '@typescript-eslint/ban-types': 0,
  '@typescript-eslint/ban-ts-comment': 0,
  '@stylistic/type-annotation-spacing': 'error',
  '@typescript-eslint/explicit-module-boundary-types': 0,
  'arrow-body-style': ['error', 'as-needed'],
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: 'default',
      format: ['camelCase']
    },
    {
      selector: 'parameter',
      format: [],
      filter: { regex: '^__', match: true }
    },
    {
      selector: 'variable',
      format: [],
      filter: { regex: '^__', match: true }
    },
    {
      selector: 'property',
      format: [
        'camelCase',
        'UPPER_CASE',
        'PascalCase',
        'snake_case'
      ],
      leadingUnderscore: 'allow'
    },
    {
      selector: 'variable',
      format: [
        'camelCase',
        'UPPER_CASE',
        'PascalCase'
      ],
      leadingUnderscore: 'allow'
    },
    {
      selector: 'method',
      format: [
        'camelCase',
        'UPPER_CASE',
        'PascalCase'
      ],
      leadingUnderscore: 'allow'
    },
    {
      selector: 'parameter',
      format: ['camelCase'],
      leadingUnderscore: 'allow'
    },
    {
      selector: 'typeLike',
      format: ['PascalCase']
    },
    {
      selector: 'function',
      format: ['PascalCase', 'camelCase']
    },
    {
      selector: 'objectLiteralProperty',
      modifiers: ['requiresQuotes'],
      format: null,
      custom: { regex: '.*', match: true }
    },
    {
      selector: 'objectLiteralMethod',
      modifiers: ['requiresQuotes'],
      format: null,
      custom: { regex: '.*', match: true }
    }
  ],
  curly: 'error',
  'dot-notation': 0,
  eqeqeq: ['error', 'smart'],
  'guard-for-in': 'error',
  'id-match': 'error',
  'max-len': ['error', { code: 180 }],
  'new-parens': 'error',
  'no-bitwise': 'error',
  'no-caller': 'error',
  'no-console': [
    'error',
    {
      allow: [
        'log',
        'warn',
        'trace',
        'debug',
        'info',
        'error',
        'Console',
        'profile',
        'profileEnd'
      ]
    }
  ],
  'no-extra-boolean-cast': 0,
  'no-prototype-builtins': 0,
  'no-debugger': 'error',
  'no-duplicate-imports': 'error',
  'no-empty': 0,
  'no-eval': 'error',
  'no-fallthrough': 'error',
  'no-invalid-this': 0,
  'no-irregular-whitespace': 'error',
  'no-multiple-empty-lines': 'error',
  'no-new-wrappers': 'error',
  'no-redeclare': 0,
  '@typescript-eslint/no-redeclare': ['error', { builtinGlobals: false, }],
  'no-shadow': ['error', { hoist: 'all' }],
  'no-sparse-arrays': 'error',
  'no-template-curly-in-string': 'error',
  'no-throw-literal': 'error',
  'no-trailing-spaces': 'error',
  'no-underscore-dangle': 0,
  'no-useless-escape': 0,
  'no-unused-expressions': 0,
  'no-unused-labels': 'error',
  'unused-imports/no-unused-imports': 'error',
  'no-var': 'error',
  'object-shorthand': 'error',
  'prefer-const': 'error',
  'prefer-object-spread': 'error',
  'prefer-template': 'error',
  'quote-props': ['error', 'as-needed'],
  radix: 'error',
  'spaced-comment': [
    'error',
    'always',
    { line: { markers: ['/'] } }
  ],
  '@typescript-eslint/no-namespace': ['error'],
  '@typescript-eslint/consistent-type-assertions': ['warn', { assertionStyle: 'never' }],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    {
      fixStyle: 'inline-type-imports',
    },
  ],
  // 'import/enforce-node-protocol-usage': ['error', 'always'],
  // 'import/no-self-import': ['error'],
  // 'import/extensions': ['error', 'ignorePackages'],
  // 'import/order': ['error', {
  //   groups: ['builtin', 'external', ['parent', 'sibling']],
  // }]
};