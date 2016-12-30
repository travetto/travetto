import Config from './config';
import * as marked from 'marked';

marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: false
});

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