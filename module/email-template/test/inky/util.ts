import { Inky } from '../../bin/lib/inky';
import { InkyComponentFactory } from '../../bin/lib/inky/factory';

export function cleanseOutput(output: string) {
  return output.trim().replace(/>[ \n]+</gm, '><').replace(/>/g, '>\n');
}

export function cleanseTemplate(input: string, factory?: InkyComponentFactory) {
  const output = Inky.render(input, factory);
  return cleanseOutput(output);
}
