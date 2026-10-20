import fs from 'node:fs/promises';
import path from 'node:path';

import { Runtime } from '@travetto/runtime';

const page = (file: string): string => path.resolve(Runtime.workspace.path, '..', 'travetto.github.io/src', file);

export const hook = {
  async afterRender({ rendered }: { rendered: Record<string, string> }): Promise<void> {
    const moduleName = 'vscode-plugin';
    let html = rendered.html;
    if (!html) {
      return;
    }

    try {
      console.log('Copying Plugin images');
      const root = Runtime.workspace.path;
      const imagesDirectory = path.resolve(root, 'images');
      for await (const file of await fs.opendir(imagesDirectory, { recursive: true })) {
        if (/[.](gif|jpe?g|png)/i.test(file.name)) {
          const relativePath = path.relative(imagesDirectory, path.resolve(file.parentPath, file.name));
          const target = page(`assets/images/${moduleName}/${relativePath}`);
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.copyFile(path.resolve(file.parentPath, file.name), target);
        }
      }

      html = html
        .replace(/href="[^"]+travetto\/tree\/[^/]+\/module\/([^/"]+)"/g, (_: string, reference: string) => `routerLink="/docs/${reference}"`)
        .replace(/^src="images\//g, `src="/assets/images/${moduleName}/`)
        .replace(/(href|src)="https?:\/\/travetto.dev\//g, (_: string, attribute: string) => `${attribute}="/`)
        .replaceAll('@', '&#64;');

      const target = page(`app/documentation/gen/${moduleName}/${moduleName}.component.html`);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, html, 'utf8');
    } catch (error) {
      if (error instanceof Error) {
        console.error(`${moduleName}: ${error.message}`);
      }
    }
  }
};
