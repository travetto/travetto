import fs from 'fs/promises';

import { IndexedModule, Package, PackageUtil, path, RootIndex } from '@travetto/manifest';
import { FileResourceProvider, TypedObject } from '@travetto/base';

import { PackUtil } from '../util';

/**
 * Utils for assembling
 */
export class AssembleUtil {

  /**
   * Minimize cached source files, by removing source mapping info
   */
  static async cleanSourceMaps(folder: string): Promise<void> {
    for (const file of await new FileResourceProvider([folder]).query(f =>
      f.endsWith('.js.map') || (f.endsWith('.js') && !!RootIndex.getEntry(f))
    )) {
      if (file.endsWith('.js.map')) {
        await fs.unlink(file);
      } else {
        const content = (await fs.readFile(file, 'utf8')).replace(/\/\/# sourceMap.*/g, '');
        await fs.writeFile(file, content);
      }
    }
  }

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

  static async copyModule(workspace: string, module: IndexedModule): Promise<void> {
    const toCopy: Promise<void>[] = [];
    for (const key of TypedObject.keys(module.files)) {
      switch (key) {
        case '$index':
        case '$root':
        case '$package':
        case 'src':
        case 'support':
        case 'bin': {
          for (const file of module.files[key]) {
            const targetPartial = file.output.split(RootIndex.manifest.outputFolder)[1];
            const target = path.resolve(workspace, targetPartial);
            toCopy.push(
              fs.mkdir(path.dirname(target), { recursive: true }).then(() =>
                fs.copyFile(file.output, path.resolve(workspace, target))
              )
            );
          }
          break;
        }
        case 'resources': break;
      }
    }
    await Promise.all(toCopy);
  }

  /**
   * Copy over all prod dependencies
   */
  static async copyProdDependencies(workspace: string): Promise<void> {
    const pkgs = await PackageUtil.visitPackages<{ pkg: Package, src: string }>(RootIndex.mainModule.source, {
      valid: req =>
        (req.rel === 'prod' || req.rel === 'opt' || req.rel === 'root') &&
        !req.pkg.name.startsWith('@types/'),
      create: req => ({ pkg: req.pkg, src: req.sourcePath }),
    });
    for (const { pkg, src } of pkgs) {
      if (RootIndex.hasModule(pkg.name)) {
        await this.copyModule(workspace, RootIndex.getModule(pkg.name)!);
      } else {
        await PackUtil.copyRecursive(src, path.resolve(workspace, 'node_modules', src));
      }
    }
  }
}