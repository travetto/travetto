import { Runtime } from '@travetto/runtime';
import { JSXElement } from '@travetto/email-inky/jsx-runtime';

import { InkyRenderer } from '../src/render/renderer.ts';
import { Html } from '../src/render/html.ts';

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
    { file: '', module: Runtime.main.name }, false)
  );
}