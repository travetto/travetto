import { FileLoader, Runtime } from '@travetto/runtime';

export class TestFixtures extends FileLoader {
  constructor(modules: string[] = []) {
    super(Runtime.modulePaths([
      '@#test/fixtures',
      '@#support/fixtures',
      ...modules.flat().map(x => `${x}#support/fixtures`),
      '@@#support/fixtures'
    ]));
  }
}