import { d, lib } from '@travetto/doc';

const ScanFsLink = d.Ref('ScanFs', '@travetto/resource/src/scan.ts');
const ResourceManagerLink = d.Ref('ResourceManager', '@travetto/resource/src/resource.ts');

export const text = d`
${d.Header()}

Base is the foundation of all ${lib.Travetto} applications.  It is intended to be a minimal application set, as well as support for commonly shared functionality. It has support for the following key areas:

${d.List(
  'Resource Management',
  'File Operations',
  'File System Scanning',
)}

${d.Section('Resource Management')}

Resource management, loading of files, and other assets at runtime is a common pattern that the ${ResourceManagerLink} encapsulates. It provides the ability to add additional search paths, as well as resolve resources by searching in all the registered paths.

${d.Code('Finding Images', 'src/image.ts')}

${d.Section('File Operations')}
The framework does a fair amount of file system scanning to auto - load files. It also needs to have knowledge of what files are available. The framework provides a simple and performant functionality for recursively finding files. This functionality leverages regular expressions in lieu of glob pattern matching(this is to minimize overall code complexity).

A simple example of finding specific ${d.Path('.config')} files in your codebase:

${d.Code('Looking for all .config files with the prefix defined by svc', 'src/find.ts')}

${d.SubSection('File System Scanning')}
${ScanFsLink} provides a breadth-first search through the file system with the ability to track and collect files via patterns.

`;