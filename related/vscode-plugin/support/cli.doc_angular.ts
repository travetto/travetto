import fs from 'fs/promises';
import { CliCommand, CliCommandShape } from '@travetto/cli';
import { path, RootIndex } from '@travetto/manifest';
import { FileQueryProvider } from '@travetto/base';

const page = (f: string): string => path.resolve(RootIndex.manifest.workspacePath, '..', 'travetto.github.io/src', f);

@CliCommand()
export class CliDocAngularCommand implements CliCommandShape {
  modName = 'vscode-plugin';

  async copyPluginImages(): Promise<void> {
    console.log('Copying Plugin images');
    const provider = new FileQueryProvider({
      paths: ['images']
    });
    for await (const file of provider.query(f => /[.](gif|jpe?g|png)/i.test(f))) {
      const target = page(`assets/images/${this.modName}/${file}`);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile((await provider.describe(file)).path, target);
    }
  }

  async main(): Promise<void> {
    await this.copyPluginImages();

    let html = await fs.readFile(path.resolve(RootIndex.manifest.workspacePath, 'DOC.html'), 'utf8');
    html = html
      .replace(/href="[^"]+travetto\/tree\/[^/]+\/module\/([^/"]+)"/g, (_, ref) => `routerLink="/docs/${ref}"`)
      .replace(/^src="images\//g, `src="/assets/images/${this.modName}/`)
      .replace(/(href|src)="https?:\/\/travetto.dev\//g, (_, attr) => `${attr}="/`);

    await fs.writeFile(page(`app/documentation/gen/${this.modName}/${this.modName}.component.html`), html, 'utf8');
  }
}