import { FileLoader, Runtime } from '@travetto/runtime';

export class TestFixtures extends FileLoader {
  constructor(modules: string[] = []) {
    super([
      '@#test/fixtures',
      '@#support/fixtures',
      ...modules.flat().map(mod => `${mod}#support/fixtures`),
      '@@#support/fixtures'
    ].map(value => Runtime.modulePath(value)));
  }
}