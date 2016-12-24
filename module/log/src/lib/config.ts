import { Configure } from '@encore/config';

export default Configure.registerNamespace('logging', {
  console: {
    enabled: true,
    type: 'console',
    formatter: 'standard',
    timestamp: true,
    colorize: false,
    align: true,
    overrideNative: null,
    prettyPrint: true
  },
  log: {
    enabled: true,
    type: 'file',
    json: false,
    name: 'out',
    filename: '',
    formatter: 'json',
    level: 'info'
  },
  error: {
    enabled: true,
    type: 'file',
    json: false,
    name: 'error',
    filename: '',
    formatter: 'json',
    level: 'error'
  }
});