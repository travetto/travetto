import * as path from '@travetto/path';
import { FileProvider, ResourceProvider } from '@travetto/base';
import { ModuleIndex } from '@travetto/boot';

@ResourceProvider('test')
export class TestFixtures extends FileProvider {

  constructor(paths = [
    path.resolve('test/fixtures')
  ]) {
    super(paths);
  }

  /**
   * Add a new search path by module
   * @param moduleName Add module's support/fixtures to search space
   */
  addModule(moduleName: string): void {
    this.addPath(path.resolve(ModuleIndex.getModule(moduleName)!.source, 'support/fixtures'));
  }
}