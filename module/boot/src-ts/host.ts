const jsExt = '.js';
const jsRe = /[.]js$/;
const tsExt = '.ts';
const tsRe = /[.]ts$/;
const tjsRe = /[.][tj]s$/;
const dtsExt = '.d.ts';
const dtsRe = /[.]d[.]ts$/;
const tsMatcher = ((file: string): boolean => file.endsWith(tsExt) && !file.endsWith(dtsExt));
const jsMatcher = ((file: string): boolean => file.endsWith(jsExt));

const isCompiled = /^1$/.test(`${process.env.TRV_COMPILED}`);

const moduleExt = isCompiled ? jsExt : tsExt;
const moduleMatcher = isCompiled ? jsMatcher : tsMatcher;

export class Host {
  static EXT = {
    output: jsExt,
    outputRe: jsRe,
    outputMatcher: jsMatcher,

    outputTypes: dtsExt,
    outputTypesRe: dtsRe,

    input: tsExt,
    inputRe: tsRe,
    inputMatcher: tsMatcher,

    inputOutputRe: tjsRe,

    module: moduleExt,
    moduleMatcher,
  };

  static FILE = {
    moduleIndex: `index${moduleExt}`
  };

  static PATH = {
    src: 'src',
    srcWithSep: 'src/',
    srcWithSepRe: /src\//,
    support: 'support',
    resources: 'resources',
    testSupport: 'test-support',
    testIsolated: 'test-isolated',
    bin: 'bin',
    test: 'test'
  };
}