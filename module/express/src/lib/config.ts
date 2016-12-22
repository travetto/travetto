import { Configure } from '@encore/config';
export default Configure.registerNamespace('express', {
  serve: true,
  port: 3000,
  session: {
    secret: 'random key',
    cookie: {
      secure: false,
      secureProxy: false
    }
  }
});
