import { Configure } from '@encore/config';

export default Configure.registerNamespace('asset', {
  maxSize: 10 * 1024 * 1024,
  allowedTypes: '',
  excludeTypes: ''
});