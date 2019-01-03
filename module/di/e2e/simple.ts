import { Application } from '..';

@Application('simple')
class SimpleApp {
  async run(domain: string, port = 3000) {
    console.log('Launching', domain, 'on port', port);
  }
}