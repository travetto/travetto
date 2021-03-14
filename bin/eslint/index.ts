import { ImportOrder } from './import-order';

export = {
  configs: {
    all: {
      plugins: ['travetto'],
      rules: { 'travetto/import-order': 'error' }
    }
  },
  rules: {
    'import-order': ImportOrder
  }
};