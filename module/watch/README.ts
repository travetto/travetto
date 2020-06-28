import { d, Travetto, Library, Code, Section, inp, Note } from '@travetto/doc';
import { Watcher } from './src/watcher';
import { RetargettingProxy } from './src/proxy';

export default d`

This module is intended to be used during development, and is not during production.  This constraint is tied to the performance hit the functionality could have at run-time.  To that end, this is primarily an utilitiy for other modules, but it's functionality could prove useful to others during development.

${Section('File Watching')}

This module  is the base file system watching support for ${Travetto} applications.  In addition to file system scanning, the framework offers a simple file watching library.  The goal is to provide a substantially smaller footprint than ${Library(`gaze`, `https://github.com/shama/gaze`)} or ${Library(`chokidar`, 'https://github.com/paulmillr/chokidar')}.  Utilizing the patterns from the file scanning, you create a ${Watcher} that either has files added manually, or has patterns added that will recursively look for files. 

${Code(`Example of watching for specific files`, 'alt/docs/src/watch.ts')}

${Section('Retargetting Proxy')}

In addition to file watching, the module also provides a core utiltity for hot reloading at runtime.  The framework makes use of ${inp`ES2015`} ${inp`Proxy`}s.  Specifically the the module provides ${RetargettingProxy}, as a means to provide a reference that can have it's underlying target changed at runtime. 

${Code(d`Example of using the ${RetargettingProxy}`, 'alt/docs/src/proxy.ts')}
`;