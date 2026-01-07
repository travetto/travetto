import fs from 'node:fs/promises';

import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { Runtime } from '@travetto/runtime';
import { path } from '@travetto/manifest';

const page = (file: string): string => path.resolve(Runtime.workspace.path, '..', 'travetto.github.io/src', file);

@CliCommand()
export class CliDocAngularCommand implements CliCommandShape {
  modName = 'vscode-plugin';

  async copyPluginImages(): Promise<void> {
    console.log('Copying Plugin images');
    const root = Runtime.workspace.path;
    for await (const file of await fs.opendir(path.resolve(root, 'images'), { recursive: true })) {
      if (/[.](gif|jpe?g|png)/i.test(file.name)) {
        const target = page(`assets/images/${this.modName}/${file.parentPath}`);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile((await path.resolve(root, file.parentPath)), target);
      }
    }
  }

  async main(): Promise<void> {
    await this.copyPluginImages();

    let html = await fs.readFile(path.resolve(Runtime.workspace.path, 'DOC.html'), 'utf8');
    html = html
      .replace(/href="[^"]+travetto\/tree\/[^/]+\/module\/([^/"]+)"/g, (_, ref) => `routerLink="/docs/${ref}"`)
      .replace(/^src="images\//g, `src="/assets/images/${this.modName}/`)
      .replace(/(href|src)="https?:\/\/travetto.dev\//g, (_, attr) => `${attr}="/`)
      .replaceAll('@', '&#64;');

    await fs.writeFile(page(`app/documentation/gen/${this.modName}/${this.modName}.component.html`), html, 'utf8');
  }
}