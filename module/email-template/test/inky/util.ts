import { html } from 'js-beautify';

import { Inky } from '../../src/inky';
import { ComponentFactory } from '../../src/inky/factory';

const OPTS = {
  indent_size: 2,
  quiet: true,
  max_preserve_newlines: 0
};

export function cleanseTemplate(input: string, factory?: ComponentFactory) {
  const output = Inky.render(input, factory);
  return cleanseOutput(output);
}

export function cleanseOutput(output: string) {
  return html(output, OPTS);
}