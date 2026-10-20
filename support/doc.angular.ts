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
        .replace(/href="[^"]+travetto\/tree\/[^/]+\/module\/([^/"]+)"/g, (_, ref) => `routerLink="/docs/${ref}"`)
        .replace(/^src="images\//g, `src="/assets/images/${moduleName}/`)
        .replace(/(href|src)="https?:\/\/travetto.dev\//g, (_, attr) => `${attr}="/`)
        .replaceAll('@', '&#64;')
        .replaceAll('process.env.NODE_ENV', text => text.replaceAll('.', '\u2024'));

      if (moduleName === 'todo-app') {
        html = html.replace(
          /(<h1>(?:[\n\r]|.)*)(<h2.*?\s*<ol>(?:[\r\n]|.)*?<\/ol>)((?:[\r\n]|.)*)/m,
          (_, heading, toc, text) =>
            `<div class="toc"><div class="inner">${toc.trim()}</div></div>\n<div class="documentation">\n${heading}\n${text}\n</div>\n`
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
