import { Application } from '@travetto/app';

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
    console.log('Launching', { domain, port });
  }
}