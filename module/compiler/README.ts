import { d, Library, inp, List, Mod, Section, pth } from '@travetto/doc';

export default d`

This module expands upon ${Library('typescript', 'http://typescriptlang.org')}, with supplemental functionality:
${List(
  d`Read ${pth`tsconfig.json`} from the project directory to provide `,
  `Supports on-the-fly compilation, nothing needs to be compiled ahead of time`,
  `Enhanced AST transformations, and transformer registration`,
  List(
    d`All AST transformations are single-file based, and runs without access to the ${inp`TypeChecker`}`
  ),
  `Intelligent caching of source files to minimize recompilation`,
  `Support for detecting changes in sources files at runtime`,
  `Allows for hot-reloading of classes during development`,
  List(
    d`Utilizes ${inp`es2015`} ${inp`Proxy`}s to allow for swapping out implementation at runtime`
  )
)}

Additionally, there is support for common AST transformations via ${Mod('transformer')}

${Section('Debugging')}

When dealing with transformers, logging is somewhat tricky as the compiler executes before the code is loaded.  To that end, the file ${pth`compiler.log`} is created in the cache directory during the compilation process. This is a location that transformers should be free to log to, for debugging, and any additional feedback.
`;

