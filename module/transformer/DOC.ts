import { d, lib, mod } from '@travetto/doc';
import { RootIndex } from '@travetto/manifest';

export const text = () => d`
${d.Header()}

This module provides support for enhanced AST transformations, and declarative transformer registration, with common patterns to support all the transformers used throughout the framework. Transformations are located by ${d.Path('support/transformer.<name>.ts')} as the filename. 

The module is primarily aimed at extremely advanced usages for things that cannot be detected at runtime.  The ${mod.Registry} module already has knowledge of all ${d.Input('class')}es and ${d.Input('field')}s, and is able to listen to changes there.  Many of the modules build upon work by some of the foundational transformers defined in ${mod.Manifest}, ${mod.Registry}, ${mod.Schema} and ${mod.Di}.  These all center around defining a registry of classes, and associated type information.

Because working with the ${lib.Typescript} API can be delicate (and open to breaking changes), creating new transformers should be done cautiously. 

${d.Section('Monorepos and Idempotency')}
Within the framework, any build or compile step will target the entire workspace, and for mono-repo projects, will include all modules.  The optimization this provides is great, but comes with a strict requirement that all compilation processes need to be idempotent.  This means that compiling a module directly, versus as a dependency should always produce the same output. This produces a requirement that all transformers are opt-in by the source code, and which transformers are needed in a file should be code-evident.  This also means that no transformers are optional, as that could produce different output depending on the dependency graph for a given module.

${d.Section('Custom Transformer')}

Below is an example of a transformer that upper cases all ${d.Input('class')}, ${d.Input('method')} and ${d.Input('param')} declarations.  This will break any code that depends upon it as we are redefining all the identifiers at compile time.  

${d.Code('Sample Transformer - Upper case all declarations', 'doc/transformer.upper.ts')}

${d.Note('This should be a strong indicator that it is very easy to break code in unexpected ways.')}

${d.Code('Sample Input', 'doc/upper.ts')}

${d.Code('Sample Output', RootIndex.getFromImport('@travetto/transformer/doc/upper')!.outputFile, false, undefined, val => val.replace(/\b(Test|name|age|dob|computeAge)\b/g, p => p.toUpperCase()))}
`;