import { Application } from '@travetto/app';
import { Url } from '@travetto/schema';

@Application('simple')
class SimpleApp {
  async run(@Url() domain: string, port = 3000) {
    console.log('Launching', { domain, port });
  }
}