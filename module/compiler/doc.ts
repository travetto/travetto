import { d, mod, lib } from '@travetto/doc';

export const text = d`
${d.Header()}

This module expands upon ${lib.Typescript}, with supplemental functionality:
${d.List(
  d`Read ${d.Path('tsconfig.json')} from the project directory to provide `,
  'Supports on-the-fly compilation, nothing needs to be compiled ahead of time',
  `Enhanced AST transformations, and transformer registration ${d.List(
    d`All AST transformations are single-file based, and runs without access to the ${d.Class('TypeChecker')}`
  )}`,
  'Intelligent caching of source files to minimize recompilation',
  'Support for detecting changes in sources files at runtime',
  d`Allows for hot-reloading of classes during development ${d.List(
    d`Utilizes ${d.Input('es2015')} ${d.Class('Proxy')}s to allow for swapping out implementation at runtime`
  )}`
)}

Additionally, there is support for common AST transformations via ${mod.Transformer}

${d.Section('Debugging')}

When dealing with transformers, logging is somewhat tricky as the compiler executes before the code is loaded.  To that end, the file ${d.Path('compiler.log')} is created in the cache directory during the compilation process. This is a location that transformers should be free to log to, for debugging, and any additional feedback.
`;

