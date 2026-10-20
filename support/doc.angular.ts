import fs from 'node:fs/promises';
import path from 'node:path';

import type { DocRenderHook } from '@travetto/doc';
import { Runtime } from '@travetto/runtime';

const page = (file: string): string => path.resolve(Runtime.workspace.path, 'related/travetto.github.io/src', file);

export const hook: DocRenderHook = {
  async afterRender({ module, rendered }): Promise<void> {
    const moduleName = module.name.endsWith('mono-repo') ? 'overview' : module.name.split('/')[1];
    let html = rendered.html;
    if (!html) {
      return;
    }

    try {
      html = html
        .replace(/href="[^"]+travetto\/tree\/[^/]+\/module\/([^/"]+)"/g, (_: string, reference: string) => `routerLink="/docs/${reference}"`)
        .replace(/^src="images\//g, `src="/assets/images/${moduleName}/`)
        .replace(/(href|src)="https?:\/\/travetto.dev\//g, (_: string, attribute: string) => `${attribute}="/`)
        .replaceAll('@', '&#64;')
        .replaceAll('process.env.NODE_ENV', (text: string) => text.replaceAll('.', '\u2024'));

      if (moduleName === 'todo-app') {
        html = html.replace(
          /(<h1>(?:[\n\r]|.)*)(<h2.*?\s*<ol>(?:[\r\n]|.)*?<\/ol>)((?:[\r\n]|.)*)/m,
          (_: string, heading: string, tableOfContents: string, text: string) =>
            `<div class="toc"><div class="inner">${tableOfContents.trim()}</div></div>\n<div class="documentation">\n${heading}\n${text}\n</div>\n`
        );
      }

      const target = page(`app/documentation/gen/${moduleName}/${moduleName}.component.html`);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, html, 'utf8');
    } catch (error) {
      if (error instanceof Error) {
        console.error(`${module.name}: ${error.message}`);
      }
    }
  }
};
