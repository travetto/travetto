import { CommonFileResourceProvider } from '@travetto/base';
import { InjectableFactory } from '@travetto/di';

export class EmailResource extends CommonFileResourceProvider {

  @InjectableFactory()
  static getResources(): EmailResource {
    return new EmailResource();
  }

  mainFolder = 'email';

  constructor(paths?: string[]) {
    super(paths);
  }
}