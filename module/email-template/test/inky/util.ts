import { html } from 'js-beautify';

import { Inky } from '../../bin/lib/inky';
import { ComponentFactory } from '../../bin/lib/inky/factory';

const OPTS = {
  ['indent_size']: 2,
  quiet: true,
  ['max_preserve_newlines']: 0
};

export function cleanseOutput(output: string) {
  return html(output, OPTS);
}

export function cleanseTemplate(input: string, factory?: ComponentFactory) {
  const output = Inky.render(input, factory);
  return cleanseOutput(output);
}
