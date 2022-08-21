import { AllConfigPartial } from '../bin/operation/pack';

const mod = (f: string): string => `node_modules/${f}`;

export const config: AllConfigPartial = {
  name: 'default',
  assemble: {
    active: true,
    cacheDir: 'cache',
    keepSource: true,
    readonly: true,
    env: {
      TRV_DYNAMIC: '0'
    },
    add: [
      { [mod('@travetto/cli/bin/trv.js')]: mod('.bin/trv') },
      { [mod('lodash/lodash.min.js')]: mod('lodash/lodash.js') },
    ],
    excludeCompile: [
      mod('@travetto/*/doc/'),
      mod('@travetto/*/e2e/'),
      mod('@travetto/*/test/'),
    ],
    exclude: [
      'bower.json',
      'LICENSE',
      'LICENCE',
      '*.map',
      '*.md',
      '*.lock',
      '*.html',
      '*.mjs',
      mod('**/*.ts'),
      '*.d.ts',
      '*.tsbuildinfo',
      '*.java',
      '*.markdown',
      '.eslintrc',
      '.npmignore',
      '.*.yml',
      'cache/compiler.*.log',
      mod('faker'),
      mod('lodash/lodash.min.js'),
      mod('source-map-support/node_modules/source-map'),
      mod('source-map-support/browser-source-map-support.js'),
      mod('bson/browser_build/'),
      mod('**/tsconfig.json'),
      mod('**/tsconfig.*.json'),
      mod('@travetto/*/doc.ts'),
      mod('typescript/'),
      mod('@types/'),
      `^./${mod('@travetto/**/*.ts')}`,
      `^./${mod('@travetto/boot/tsconfig.trv.json')}`,
      '^./resources/',
      '^./src/',
    ]
  },
  zip: {
    active: false,
    output: 'output.zip'
  },
  docker: {
    active: false,
    image: 'node:16-alpine'
  }
};