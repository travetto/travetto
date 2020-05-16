travetto: Watch
===

**Install: primary**
```bash
$ npm install @travetto/watch
```

Watch is the base file system watching support for `travetto` applications.  In addition to file system scanning, the framework offers a simple file watching library.  The goal is to provide a substantially smaller footprint than [`gaze`](https://github.com/shama/gaze) or [`chokidar`](https://github.com/paulmillr/chokidar).  Utilizing the patterns from the file scanning, you create a `Watcher` that either has files added manually, or has patterns added that will recursively look for files. 

**Code: Example of watching for specific files**
```typescript
const watcher = new Watcher({cwd: 'base/path/to/...'});
watcher.add([
  'local.config',
  {
    testFile: x => x.endsWith('.config') || x.endsWith('.config.json')
  }
]);
watcher.run();
```