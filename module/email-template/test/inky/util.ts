import { html } from 'js-beautify';

import { Inky } from '../../src/inky';
import { ComponentFactory } from '../../src/inky/factory';

/* eslint-disable @typescript-eslint/camelcase */
const OPTS = {
  indent_size: 2,
  quiet: true,
  max_preserve_newlines: 0
};
/* eslint-enable @typescript-eslint/camelcase */

export function cleanseOutput(output: string) {
  return html(output, OPTS);
}

export function cleanseTemplate(input: string, factory?: ComponentFactory) {
  const output = Inky.render(input, factory);
  return cleanseOutput(output);
}
