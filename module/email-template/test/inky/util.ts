import { Inky } from '../../support/bin/inky';
import { InkyComponentFactory } from '../../support/bin/inky/factory';

export function cleanseOutput(output: string) {
  return output.trim().replace(/>[ \n]+</gm, '><').replace(/>/g, '>\n').replace(/^[ ]+/gm, '').replace(/^\s+[\n]/gm, '').replace(/&zwj;</g, '&zwj;\n<');
}

export function cleanseTemplate(input: string, factory?: InkyComponentFactory) {
  const output = Inky.render(input, factory);
  return cleanseOutput(output);
}
