import { Application } from '../../../src/decorator';

@Application('simple-domain')
class SimpleApp {
  async run(domain: string, port = 3000) {
    console.log('Launching', { domain, port });
  }
}