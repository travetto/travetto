import { Configure } from '@encore/config';
export default Configure.registerNamespace('mongo', {
  host: 'localhost',
  schema: 'app',
  port: 27017
});