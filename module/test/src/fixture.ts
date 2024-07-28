import { FileLoader, Runtime } from '@travetto/runtime';

export class TestFixtures extends FileLoader {
  constructor(modules: string[] = []) {
    super([
      '@#test/fixtures',
      '@#support/fixtures',
      ...modules.flat().map(x => `${x}#support/fixtures`),
      '@@#support/fixtures'
    ].map(v => Runtime.modulePath(v)));
  }
}