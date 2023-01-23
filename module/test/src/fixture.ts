import { FileResourceProvider } from '@travetto/base';

export class TestFixtures extends FileResourceProvider {
  constructor(paths: string[] = []) {
    super({ paths: ['@', ...paths,], moduleFolder: 'support/fixtures', mainFolder: 'test/fixtures' });
  }
}