import { Configure } from '@encore/config';
export default Configure.registerNamespace('mail', {
  transport: {
    host: 'mail-dev',
    port: 25,
    ignoreTLS: true
  },
  from: 'Express Mongo <express@mongo.com>'
});