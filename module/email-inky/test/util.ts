import { Runtime } from '@travetto/base';
import { JSXElement } from '@travetto/email-inky/jsx-runtime';

import { InkyRenderer } from '../src/render/renderer';
import { Html } from '../src/render/html';

export function cleanseOutput(output: string) {
  return output.trim()
    .replace(/\s*<!--\s*[$]:([^ -]+)\s*-->\s*(<\/[^>]+>)/g, (_, suf, tag) => `${tag}${suf}`)
    .replace(/(<[^\/][^>]+>)\s*<!--\s*[#]:([^ ]+)\s*-->\s*/g, (_, tag, pre) => `${pre}${tag}`)
    .replace(/[ ]+>/g, '>')
    .replaceAll('<', '\n<')
    .replaceAll('>', '>\n')
    .replaceAll('\n', '%%')
    .replace(/\s*%%\s*/gm, '%%')
    .replaceAll(/%%+/gm, '\n');
}

export async function renderJSX(element: JSXElement): Promise<string> {
  return cleanseOutput(await InkyRenderer.render(
    element,
    Html,
    { file: '', module: Runtime.context.main.name }, false)
  );
}