const { doc: d, inp, List, Mod, Section, pth, lib, cls, Execute, fld, SubSection, Snippet, Code, Terminal } = require('@travetto/doc');

exports.text = d`

This module expands upon ${lib.Typescript}, with supplemental functionality:
${List(
  d`Read ${pth`tsconfig.json`} from the project directory to provide `,
  `Supports on-the-fly compilation, nothing needs to be compiled ahead of time`,
  `Enhanced AST transformations, and transformer registration ${List(
    d`All AST transformations are single-file based, and runs without access to the ${cls`TypeChecker`}`
  )}`,
  `Intelligent caching of source files to minimize recompilation`,
  `Support for detecting changes in sources files at runtime`,
  d`Allows for hot-reloading of classes during development ${List(
    d`Utilizes ${inp`es2015`} ${cls`Proxy`}s to allow for swapping out implementation at runtime`
  )}`
)}

Additionally, there is support for common AST transformations via ${Mod('transformer')}

${Section('Debugging')}

When dealing with transformers, logging is somewhat tricky as the compiler executes before the code is loaded.  To that end, the file ${pth`compiler.log`} is created in the cache directory during the compilation process. This is a location that transformers should be free to log to, for debugging, and any additional feedback.

${Section('CLI - compile')} 

${Execute('Compiler usage', 'travetto', ['compile', '--help'])}

This command line operation pre-compiles all of the application source code.  You can target the output location as well, which is useful in conjunction with ${fld`process.env.TRV_CACHE`} for relocating the compiled files.

${Section('CLI - pack')} 

${Execute('Pack usage', 'travetto', ['pack', '--help'])}

This command line operation will compile your project, and produce a ready to use workspace as a deliverable.  The output can be zipped on demand, or left as a folder structure for integration with other tools.  

${SubSection('Configuration')}

By default packing follows a default pattern driven by a configuration structure:
${Snippet('Config Structure', './bin/lib/pack.ts', /type Flags/, /^}$/)}

A project can define it's own configuration at the root of the project with ${pth`pack.config.yml`}. 

${Code('Example pack.config.yml', './alt/docs/pack.config.yml')}

${SubSection('Modes')}
Various modules may provide customizations to the default ${pth`pack.config.yml`} to allow for easy integration with the packing process.  A simple example of this is via the ${Mod('rest')} module, for how to publish lambda packages.

${Terminal('Invoking Pack with Mode', `npx travetto pack <mode>`)}
`;

