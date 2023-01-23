import { FileResourceProvider } from '@travetto/base';
import { InjectableFactory } from '@travetto/di';

export class EmailResource extends FileResourceProvider {

  @InjectableFactory()
  static getResources(): EmailResource {
    return new EmailResource();
  }

  constructor(paths?: string[]) {
    super({ paths, includeCommon: true });
  }
}