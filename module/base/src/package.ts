import { PackageUtil, Package, PackageDigest } from '@travetto/manifest';
import { path, ModuleIndex } from '@travetto/boot';

export class Pkg {

  static #config: Package | undefined;

  static get main(): Package {
    if (!this.#config) {
      const { output: mainFolder } = ModuleIndex.getModule(ModuleIndex.manifest.mainModule)!;
      try {
        this.#config = PackageUtil.readPackage(mainFolder);
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.warn(`Unable to locate ${path.resolve(mainFolder, 'package.json')}: ${err.message}`);
        } else {
          throw err;
        }
        this.#config = {
          name: 'untitled',
          version: '0.0.0',
          main: 'unknown',
        };
      }
      this.#config.name ??= 'untitled';
      this.#config.description ??= 'A Travetto application';
      this.#config.version ??= '0.0.0';
    }
    return this.#config;
  }

  static mainDigest(): PackageDigest {
    return PackageUtil.digest(this.main);
  }
}