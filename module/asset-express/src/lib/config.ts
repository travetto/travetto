import { Configure } from '@encore/config';

export default Configure.registerNamespace('asset', {
  maxSize: 10000,
  allowedTypes: '*',
  excludeTypes: ''
});