import { Application } from '@travetto/app';
import { RestApplication } from '@travetto/rest';

@Application('custom')
export class SampleApp extends RestApplication {

  override run() {
    // Configure server before running
    return super.run();
  }
}