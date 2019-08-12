import { Application } from '../..';

@Application('complex', {
  paramMap: {
    domain: {
      title: 'Domain Name',
      type: 'string',
      subtype: 'url'
    },
    port: {
      title: 'Server Port',
      def: '3000'
    }
  }
})
class Complex {
  async run(domain: string, port: number) {
    console.debug('Launching', domain, 'on port', port);
  }
}