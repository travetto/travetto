module.exports = {
  'package.json': {},
  'src/model/config.ts': {
    requires: ['model', 'model-'],
  },
  'src/model/todo.ts': {
    requires: ['model'],
  },
  'test/model/todo.ts': {
    requires: ['model', 'test'],
  },
  'src/rest/todo.ts': {
    requires: ['rest', 'model'],
  },
  'src/rest/primary.ts': {
    requires: ['rest'],
  },
  'src/rest/config.ts': {
    requires: ['rest', 'rest-'],
  },
  'src/rest/app.ts': {
    requires: ['rest']
  }
};