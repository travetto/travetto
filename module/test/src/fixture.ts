import { FileLoader, RuntimeContext } from '@travetto/base';

export class TestFixtures extends FileLoader {
  constructor(modules: string[] = []) {
    super(RuntimeContext.modulePaths([
      '@#test/fixtures',
      ...['@', ...modules.flat(), '@@'].map(x => `${x}#support/fixtures`)
    ]));
  }
}