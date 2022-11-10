import { Env, FileResourceProvider } from '@travetto/base';
import { InjectableFactory } from '@travetto/di';

export class EmailResource extends FileResourceProvider {

  @InjectableFactory()
  static getResources(): EmailResource {
    return new EmailResource();
  }

  mainFolder = 'email';

  constructor(paths?: string[]) {
    super(paths ?? Env.getList('TRV_RESOURCES'));
  }
}