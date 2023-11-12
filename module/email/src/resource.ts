import { ResourceLoader } from '@travetto/base';
import { InjectableFactory } from '@travetto/di';

export class EmailResource extends ResourceLoader {

  @InjectableFactory()
  static getResources(): EmailResource {
    return new EmailResource();
  }
}