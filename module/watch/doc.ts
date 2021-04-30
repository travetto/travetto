import { d, lib } from '@travetto/doc';

import { Watcher } from './src/watcher';

export const text = d`
${d.Header()}

This module is intended to be used during development, and is not during production.  This constraint is tied to the performance hit the functionality could have at run-time.  To that end, this is primarily an utilitiy for other modules, but it's functionality could prove useful to others during development.

${d.Section('File Watching')}

This module  is the base file system watching support for ${lib.Travetto} applications.  In addition to file system scanning, the framework offers a simple file watching library.  The goal is to provide a substantially smaller footprint than ${lib.Gaze} or ${lib.Chokidar}.  Utilizing the patterns from the file scanning, you create a ${Watcher} that either has files added manually, or has patterns added that will recursively look for files. 

${d.Code('Example of watching for specific files', 'doc/watch.ts')}
`;