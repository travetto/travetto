module.exports = {
  env: {
    es6: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    '@typescript-eslint/array-type': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-member-accessibility': [
      'off',
      {
        accessibility: 'explicit'
      }
    ],
    indent: 'off',
    '@typescript-eslint/indent': [
      'error',
      2
    ],
    '@typescript-eslint/member-delimiter-style': [
      'error',
      {
        multiline: {
          delimiter: 'semi',
          requireLast: true
        },
        singleline: {
          delimiter: 'comma',
          requireLast: false
        }
      }
    ],
    '@typescript-eslint/no-use-before-define': [
      'error',
      { classes: false }
    ],
    '@typescript-eslint/member-ordering': [
      'error',
      {
        default: [
          // Fields
          'private-static-field',
          'protected-static-field',
          'public-static-field',

          'private-static-method',
          'protected-static-method',
          'public-static-method',

          'private-instance-field',
          'protected-instance-field',
          'public-instance-field',

          // Constructors
          'private-constructor',
          'protected-constructor',
          'public-constructor',

          // Methods
          'private-instance-method',
          'protected-instance-method',
          'public-instance-method'
        ]
      }
    ],
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-for-in-array': 'error',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-this-alias': 'error',
    'require-atomic-updates': ['off'],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '^(__|[A-Z])[A-Za-z0-9]*',
        args: 'none'
      }
    ],
    '@typescript-eslint/quotes': [
      'error',
      'single',
      {
        avoidEscape: true,
        allowTemplateLiterals: true
      }
    ],
    '@typescript-eslint/semi': [
      'error',
      'always'
    ],
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
      {
        selector: 'default',
        format: ['camelCase'],
      },
      {
        selector: 'parameter',
        format: [],
        filter: { regex: '^__', match: true },
      },
      {
        selector: 'variable',
        format: [],
        filter: { regex: '^__', match: true },
      },
      {
        selector: 'property',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase', 'snake_case'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'method',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow'
      },
      {
        selector: 'parameter',
        format: ['camelCase'],
        leadingUnderscore: 'allow',
      },

      {
        selector: 'typeLike',
        format: ['PascalCase']
      },
      {
        selector: 'function',
        format: ['PascalCase', 'camelCase']
      }
    ],
    curly: 'error',
    'dot-notation': 'off',
    eqeqeq: [
      'error',
      'smart'
    ],
    'guard-for-in': 'error',
    'id-match': 'error',
    'max-len': [
      'error',
      {
        code: 180
      }
    ],
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
          'profileEnd',
        ]
      }
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
    'no-redeclare': 'error',
    'no-shadow': [
      'error',
      {
        hoist: 'all'
      }
    ],
    'no-sparse-arrays': 'error',
    'no-template-curly-in-string': 'error',
    'no-throw-literal': 'error',
    'no-trailing-spaces': 'error',
    'no-underscore-dangle': [
      'off',
    ],
    'no-useless-escape': ['off'],
    'no-unused-expressions': 'off',
    'no-unused-labels': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-const': 'error',
    'prefer-object-spread': 'error',
    'prefer-template': 'error',
    'quote-props': [
      'error',
      'as-needed'
    ],
    radix: 'error',
    'spaced-comment': ['error', 'always', { line: { markers: ['/'] } }]
  }
};
