import { d, lib, mod } from '@travetto/doc';

export const text = d`
${d.Header()}

This module provides support for enhanced AST transformations, and declarative transformer registration, with common patterns to support all the transformers used throughout the framework. Transformations are located by ${d.Path('support/transformer.<name>.ts')} as the filename. 

The module is primarily aimed at extremely advanced usages for things that cannot be detected at runtime.  The ${mod.Registry} module already has knowledge of all ${d.Input('class')}es and ${d.Input('field')}s, and is able to listen to changes there.  Many of the modules build upon work by some of the foundational transformers defined in ${mod.Registry}, ${mod.Schema} and ${mod.Di}.  These all center around defining a registry of classes, and associated type information.

Because working with the ${lib.Typescript} API can be delicate (and open to breaking changes), creating new transformers should be done cautiously. 

${d.Section('Custom Transformer')}

Below is an example of a transformer that uppercases all ${d.Input('class')}, ${d.Input('method')} and ${d.Input('param')} declarations.  This will break any code that depends upon it as we are redefining all the identifiers at compile time.  

${d.Code('Sample Transformer - Upper case all declarations', 'doc/support/transformer.ts')}

${d.Note('This should be a strong indicator that it is very easy to break code in unexpected ways.')}
`;