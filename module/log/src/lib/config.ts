import { registerNamespace } from '@encore/init';

export default registerNamespace('logging', {
  console: {
    enabled: true,
    type: 'console',
    formatter: 'standard'
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