import { Configure } from '@encore/config';

export default Configure.registerNamespace('mail', {
  transport: {
    host: 'mail-dev',
    port: 25,
    ignoreTLS: true
  },
  from: 'Express Mongo <express@mongo.com>'
}, (config) => {
  // Mock mail out
  if (!config.transport) {
    let mockTransport = require('nodemailer-mock-transport');
    config.transport = mockTransport();
  } else if ((config as any).transport === 'sendmail') {
    let sendmailTransport = require('nodemailer-sendmail-transport');
    config.transport = sendmailTransport({
      path: '/usr/sbin/sendmail'
    });
  }
});