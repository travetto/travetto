import { Configure } from '@encore/config';

export default Configure.registerNamespace('logging', {
  appenders: {
    console: {
      type: 'console',
      enabled: true,
      replaceConsole: null,
      level: 'info',
      layout: {
        type: 'standard',
        timestamp: true,
        colorize: false,
        align: true,
        prettyPrint: true
      },
    },
    log: {
      name: 'out',
      type: 'file',
      enabled: true,
      filename: '',
      layout: { type: 'json' },
      level: 'info'
    },
    error: {
      name: 'error',
      type: 'file',
      enabled: true,
      filename: '',
      layout: { type: 'json' },
      level: 'error'
    }
  },
  categories: {
    default: {
      appenders: 'console,log',
      level: 'info'
    },
    error: {
      appenders: 'error',
      level: 'error'
    }
  }
});