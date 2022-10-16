const jsExt = '.js';
const jsRe = /[.]js$/;
const tsExt = '.ts';
const tsRe = /[.]ts$/;
const tjsRe = /[.][tj]s$/;
const dtsExt = '.d.ts';
const dtsRe = /[.]d[.]ts$/;
const tsMatcher = ((file: string): boolean => file.endsWith(tsExt) && !file.endsWith(dtsExt));

export class Host {
  static EXT = {
    output: jsExt,
    outputRe: jsRe,

    outputTypes: dtsExt,
    outputTypesRe: dtsRe,

    input: tsExt,
    inputRe: tsRe,
    inputMatcher: tsMatcher,

    inputOutputRe: tjsRe,
  };
}