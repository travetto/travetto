import fs from 'fs/promises';

import { IndexedModule, Package, PackageUtil, path, RootIndex } from '@travetto/manifest';
import { FileResourceProvider, TypedObject } from '@travetto/base';

import { PackUtil } from '../util';

/**
 * Utils for assembling
 */
export class AssembleUtil {

  /**
   * Purge workspace using file rules
   */
  static async excludeFiles(root: string, files: string[]): Promise<void> {
    const checker = PackUtil.excludeChecker(files, root);
    for (const el of await new FileResourceProvider([root]).query(checker, true)) {
      try {
        await fs.unlink(el);
      } catch { }
    }
  }

  /**
   * Copy over added content
   */
  static async copyAddedContent(workspace: string, files: Record<string, string>[]): Promise<void> {
    for (const a of files) {
      let [src, dest] = Object.entries(a)[0];
      [src, dest] = [path.resolve(src), path.resolve(workspace, dest)];
      const stat = await fs.stat(src).catch(() => { });
      if (stat) {
        if (stat.isFile()) {
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(src, dest);
        } else {
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await PackUtil.copyRecursive(src, dest);
        }
      }
    }
  }

  static async copyModule(workspace: string, module: IndexedModule, keepSource?: boolean): Promise<void> {
    const toCopy: Promise<void>[] = [];
    for (const [key, files] of TypedObject.entries(module.files)) {
      switch (key) {
        case '$index':
        case '$root':
        case '$package':
        case 'src':
        case 'support':
        case 'resources':
        case 'bin': {
          for (const file of files) {
            const targetPartial = file.output.split(RootIndex.manifest.outputFolder)[1];
            const target = path.join(workspace, targetPartial);
            const src = await fs.stat(file.output).then(() => file.output, () => file.source);
            toCopy.push((async (): Promise<void> => {
              await fs.mkdir(path.dirname(target), { recursive: true });
              await fs.copyFile(src, target);

              if (file.type === 'ts' || file.type === 'js') {
                if (keepSource) {
                  await fs.copyFile(`${src}.map`, `${target}.map`).catch(() => { });
                } else {
                  await fs.writeFile(target, (await fs.readFile(target, 'utf8')).replace(/\/\/# sourceMap.*/g, ''));
                }
              }
            })());
          }
          break;
        }
      }
    }
    await Promise.all(toCopy);
  }

  /**
   * Copy over all prod dependencies
   */
  static async copyProdDependencies(workspace: string, keepSource?: boolean): Promise<void> {
    const pkgs = await PackageUtil.visitPackages<{ pkg: Package, src: string }>(RootIndex.mainModule.source, {
      valid: req =>
        (req.rel === 'prod' || req.rel === 'opt' || req.rel === 'root') &&
        !req.pkg.name.startsWith('@types/'),
      create: req => ({ pkg: req.pkg, src: req.sourcePath }),
    });
    await fs.mkdir(path.resolve(workspace, 'node_modules'), { recursive: true });
    for (const { pkg, src } of pkgs) {
      if (RootIndex.hasModule(pkg.name)) {
        await this.copyModule(workspace, RootIndex.getModule(pkg.name)!, keepSource);
      } else {
        const folder = path.dirname(path.resolve(workspace, 'node_modules', src.replace(/^.*?node_modules\//, '')));
        await PackUtil.copyRecursive(src, folder);
      }
    }
  }

  /**
   * Copy over entry point
   */
  static async copyEntryPoint(workspace: string): Promise<void> {
    // Faux-package.json
    await fs.writeFile(path.resolve(workspace, 'package.json'), JSON.stringify({
      name: '@entry/main',
      version: RootIndex.mainPackage.version,
      dependencies: { [RootIndex.mainPackage.name]: '*', }
    }, null, 2), 'utf8');

    const manifest = structuredClone(RootIndex.manifest);
    for (const [name, mod] of TypedObject.entries(manifest.modules)) {
      if (!mod.profiles.includes('std')) {
        delete manifest.modules[name];
      }
    }

    await fs.writeFile(path.resolve(workspace, 'manifest.json'), JSON.stringify(manifest), 'utf8');

    const output = path.resolve(RootIndex.manifest.workspacePath, RootIndex.manifest.outputFolder);
    for (const file of [
      path.resolve(output, 'trv'), // Entry points
      path.resolve(output, 'trv.cmd')
    ]) {
      await fs.copyFile(file, path.resolve(workspace, path.basename(file)));
    }
  }
}