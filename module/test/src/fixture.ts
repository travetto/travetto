import { FileResourceProvider } from '@travetto/base';

export class TestFixtures extends FileResourceProvider {
  moduleFolder = 'support/fixtures';
  pathFolder = 'test/fixtures';
}