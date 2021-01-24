import { AllConfigPartial } from '../bin/operation/pack';

export const config: AllConfigPartial = {
  name: 'default',
  assemble: {
    active: true,
    cacheDir: 'cache',
    keepSource: true,
    readonly: true,
    add: [
      { 'node_modules/@travetto/cli/bin/trv.js': 'node_modules/.bin/trv' },
      { 'node_modules/lodash/lodash.min.js': 'node_modules/lodash/lodash.js' },
    ],
    excludeCompile: [
      'node_modules/@travetto/*/alt/',
      'node_modules/@travetto/*/test/',
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
      '*.ts',
      '*.d.ts',
      '*.tsbuildinfo',
      '*.java',
      '*.markdown',
      '.eslintrc',
      '.npmignore',
      '.*.yml',
      'cache/compiler.*.log',
      'node_modules/lodash/lodash.min.js',
      'node_modules/source-map-support/node_modules/source-map',
      'node_modules/source-map-support/browser-source-map-support.js',
      'node_modules/bson/browser_build/',
      'node_modules/**/tsconfig.json',
      'node_modules/**/tsconfig.*.json',
      'node_modules/@travetto/*/doc.ts',
      'node_modules/typescript/',
      'node_modules/@types/',
      '^./node_modules/@travetto/**/*.ts',
      '^./node_modules/@travetto/*/tsconfig.json',
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
    image: 'node:14.8.0-alpine3.10'
  }
};