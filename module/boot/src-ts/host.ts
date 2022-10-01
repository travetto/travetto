import { EnvUtil } from './env';
const jsExt = '.js';
const jsRe = /[.]js$/;
const tsExt = '.ts';
const tsRe = /[.]ts$/;
const tjsRe = /[.][tj]s$/;
const dtsExt = '.d.ts';
const dtsRe = /[.]d[.]ts$/;
const tsMatcher = ((file: string): boolean => file.endsWith(tsExt) && !file.endsWith(dtsExt));
const jsMatcher = ((file: string): boolean => file.endsWith(jsExt));

const runningExt = EnvUtil.isCompiled() ? jsExt : tsExt;

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

    running: runningExt,
    runningMatcher: EnvUtil.isCompiled() ? jsMatcher : tsMatcher,
    runningIndex: `index${runningExt}`
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