import { JSXElement } from '@travetto/email-inky/jsx-runtime';

import { InkyRenderer } from '../src/render/renderer';
import { Html } from '../src/render/html';

export function cleanseOutput(output: string) {
  return output.trim()
    .replace(/>[ \n]+</gm, '><')
    .replace(/>/g, '>\n')
    .replace(/^[ ]+/gm, '')
    .replace(/^\s+[\n]/gm, '')
    .replace(/&zwj;</g, '&zwj;\n<');
}

export async function renderJSX(element: JSXElement): Promise<string> {
  return cleanseOutput(await InkyRenderer.render({ text: element }, Html));
}