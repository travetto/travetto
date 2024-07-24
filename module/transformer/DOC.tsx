/** @jsxImportSource @travetto/doc */
import fs from 'node:fs/promises';

import { d, c } from '@travetto/doc';
import { RuntimeIndex } from '@travetto/base';

export const text = async () => {

  const output = (await fs.readFile(RuntimeIndex.getFromImport('@travetto/transformer/doc/upper')!.outputFile, 'utf8'))
    .replace(/\b(Test|name|age|dob|computeAge)\b/g, p => p.toUpperCase());

  return <>
    <c.StdHeader />
    This module provides support for enhanced AST transformations, and declarative transformer registration, with common patterns to support all the transformers used throughout the framework. Transformations are located by {d.path('support/transformer.<name>.ts')} as the filename. <br />

    The module is primarily aimed at extremely advanced usages for things that cannot be detected at runtime.  The {d.mod('Registry')} module already has knowledge of all {d.input('class')}es and {d.input('field')}s, and is able to listen to changes there.  Many of the modules build upon work by some of the foundational transformers defined in {d.mod('Manifest')}, {d.mod('Registry')}, {d.mod('Schema')} and {d.mod('Di')}.  These all center around defining a registry of classes, and associated type information. <br />

    Because working with the {d.library('Typescript')} API can be delicate (and open to breaking changes), creating new transformers should be done cautiously.

    <c.Section title='Monorepos and Idempotency'>
      Within the framework, any build or compile step will target the entire workspace, and for mono-repo projects, will include all modules.  The optimization this provides is great, but comes with a strict requirement that all compilation processes need to be idempotent.  This means that compiling a module directly, versus as a dependency should always produce the same output. This produces a requirement that all transformers are opt-in by the source code, and which transformers are needed in a file should be code-evident.  This also means that no transformers are optional, as that could produce different output depending on the dependency graph for a given module.
    </c.Section>

    <c.Section title='Custom Transformer'>

      Below is an example of a transformer that upper cases all {d.input('class')}, {d.input('method')} and {d.input('param')} declarations.  This will break any code that depends upon it as we are redefining all the identifiers at compile time.

      <c.Code title='Sample Transformer - Upper case all declarations' src='doc/transformer.upper.ts' />

      <c.Note>This should be a strong indicator that it is very easy to break code in unexpected ways.</c.Note>

      <c.Code title='Sample Input' src='doc/upper.ts' />

      <c.Code title='Sample Output' src={output} language='javascript' />
    </c.Section>
  </>;
};