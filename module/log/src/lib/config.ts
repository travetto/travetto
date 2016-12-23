import { Configure } from '@encore/config';

export default Configure.registerNamespace('logging', {
  console: {
    enabled: true,
    type: 'console',
    formatter: 'standard',
    timestamp: true,
    colorize: false,
    align: true,
    overrideNative: false
  },
  log: {
    enabled: true,
    type: 'file',
    name: 'out',
    filename: '',
    formatter: 'json',
    level: 'info'
  },
  error: {
    enabled: true,
    type: 'file',
    name: 'error',
    filename: '',
    formatter: 'json',
    level: 'error'
  }
});