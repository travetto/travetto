import { Configure } from '@encore/config';
export default Configure.registerNamespace('mail', {
  transport: {
    host: 'mail-dev',
    port: 25,
    ignoreTLS: true
  },
  from: 'Express Mongo <express@mongo.com>'
}, (Config) => {
  // Mock mail out
  if (!Config.transport) {
    let mockTransport = require('nodemailer-mock-transport');
    Config.transport = mockTransport();
  } else if ((Config as any).transport === 'sendmail') {
    let sendmailTransport = require('nodemailer-sendmail-transport');
    Config.transport = sendmailTransport({
      path: '/usr/sbin/sendmail'
    });
  }
});