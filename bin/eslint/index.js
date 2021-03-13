module.exports = {
  configs: {
    all: {
      plugins: ['travetto'],
      rules: { 'travetto/import-order': 'error' }
    }
  },
  rules: {
    'import-order': require('./import-order')
  }
};