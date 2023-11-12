import { FileLoader } from '@travetto/base';

export class TestFixtures extends FileLoader {
  constructor(modules: string[] = []) {
    super(['@#test/fixtures', ...['@', ...modules.flat()].map(x => `${x}#support/fixtures`)]);
  }
}