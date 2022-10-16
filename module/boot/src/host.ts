const jsExt = '.js';
const jsRe = /[.]js$/;
const tsExt = '.ts';
const tsRe = /[.]ts$/;
const tjsRe = /[.][tj]s$/;
const dtsExt = '.d.ts';
const dtsRe = /[.]d[.]ts$/;
const tsMatcher = ((file: string): boolean => file.endsWith(tsExt) && !file.endsWith(dtsExt));
const jsMatcher = ((file: string): boolean => file.endsWith(jsExt));

const compiled = process.env.TRV_COMPILED === '1';

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

    moduleExt: compiled ? jsExt : tsExt,
    moduleMatcher: compiled ? jsMatcher : tsMatcher
  };

  static PATH = {
    src: 'src',
    srcWithSep: 'src/',
    srcWithSepRe: /src\//,
    support: 'support',
    supportWithSep: 'support/',
    resources: 'resources',
    bin: 'bin',
    test: 'test'
  };
}