# Watch
## Support for making files watchable during runtime

**Install: @travetto/watch**
```bash
npm install @travetto/watch
```

This module is intended to be used during development, and is not during production.  This constraint is tied to the performance hit the functionality could have at run-time.  To that end, this is primarily an utilitiy for other modules, but it's functionality could prove useful to others during development.

## File Watching

This module  is the base file system watching support for [travetto](https://travetto.dev) applications.  In addition to file system scanning, the framework offers a simple file watching library.  The goal is to provide a substantially smaller footprint than [gaze](https://github.com/shama/gaze) or [chokidar](https://github.com/paulmillr/chokidar).  Utilizing the patterns from the file scanning, you create a [Watcher](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module/watch/src/watcher.ts#L40) that either has files added manually, or has patterns added that will recursively look for files. 

**Code: Example of watching for specific files**
```typescript
import { Watcher } from '@travetto/watch/src/watcher';

const watcher = new Watcher({ cwd: 'base/path/to/...' });
watcher.add([
  'local.config',
  {
    testFile: x => x.endsWith('.config') || x.endsWith('.config.json')
  }
]);
watcher.run();
```

## Retargetting Proxy

In addition to file watching, the module also provides a core utiltity for hot reloading at runtime.  The framework makes use of `ES2015` `Proxy`s.  Specifically the the module provides [RetargettingProxy](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module/watch/src/proxy.ts#L84), as a means to provide a reference that can have it's underlying target changed at runtime. 

**Code: Example of using the RetargettingProxy**
```typescript
import { RetargettingProxy } from '@travetto/watch/src/proxy';

class User { }

export class CoolService {
  async tricky() {
    const target = new User();
    const proxy = new RetargettingProxy(target);

    // Update target a second later
    setTimeout(() => {
      proxy.setTarget(new User());
    }, 1000);

    return proxy;
  }
}
```

