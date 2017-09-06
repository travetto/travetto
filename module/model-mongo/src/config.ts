import { Config } from '@encore/config';

export default Configure.registerNamespace('mongo', {
  hosts: 'localhost',
  schema: 'app',
  port: 27017,
  options: {}
});