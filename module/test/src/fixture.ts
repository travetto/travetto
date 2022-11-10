import * as path from '@travetto/path';
import { FileResourceProvider } from '@travetto/base';


export class TestFixtures extends FileResourceProvider {
  moduleFolder = 'support/fixtures';

  constructor(paths: string[] = []) {
    super([
      path.resolve('test/fixtures'),
      ...paths,
    ])
  }
}