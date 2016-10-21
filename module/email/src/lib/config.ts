import { registerNamespace } from '@encore/init';
export default registerNamespace('mail', {
  transport: {
    host: "mail-dev",
    port: 25,
    ignoreTLS: true
  },
  from: 'Express Mongo <express@mongo.com>'
});