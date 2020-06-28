import { Watcher } from '../../../src/watcher';

const watcher = new Watcher({ cwd: 'base/path/to/...' });
watcher.add([
  'local.config',
  {
    testFile: x => x.endsWith('.config') || x.endsWith('.config.json')
  }
]);
watcher.run();