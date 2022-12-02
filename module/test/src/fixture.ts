import { FileResourceProvider } from '@travetto/base';

export class TestFixtures extends FileResourceProvider {
  moduleFolder = 'support/fixtures';
  mainFolder = 'test/fixtures';

  constructor(paths: string[] = []) {
    super(['@', ...paths,]);
  }
}