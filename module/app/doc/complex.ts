import { Application } from '@travetto/app';

@Application('complex')
class Complex {
  async run(domain: string, port: number = 3000) {
    console.log('Launching', { domain, port });
  }
}