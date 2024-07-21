/** @jsxImportSource @travetto/doc */

import fs from 'node:fs/promises';

import { MetadataIndex } from '@travetto/manifest';
import { c, d, DocJSXElement } from '@travetto/doc';

function NodeList({ src }: { src: string }): DocJSXElement {
  const lines = src.split(/\n/g);
  const compRe = /^const (\S+): CompFn.*?\/\/\s*(.*)\s*$/;
  const features = lines
    .filter(line => compRe.test(line))
    .map(line => {
      const [, name, desc] = line.match(compRe)!;
      return { name, desc };
    });

  const children = features.sort((a, b) => a.name.localeCompare(b.name))
    .map(f => <li>{d.method(f.name)} - {f.desc}</li>);

  return <ul>{...children}</ul>;
}

export const text = async () => {
  const nodeContents = await fs.readFile(MetadataIndex.getSourceFile('@travetto/doc/src/jsx.ts'), 'utf8');

  return <>
    <c.StdHeader />
    This module provides the ability to generate documentation in {d.library('HTML')} and/or {d.library('Markdown')}.  The module relies on integrating with the source of the project, and providing a fully referenced code-base.  This allows for automatic updates when code is changed and/or refactored.

    <c.Code title='Document Sample' src='doc/sample.tsx' />

    <c.Code title='Document Context' src='src/types.ts' startRe={/interface DocumentShape/} endRe={/^[}]/} />

    As you can see, you need to export a field named {d.field('text')} as the body of the help text. The {d.field('text')} field can be either a direct invocation or an async function that returns the expected document output.

    <c.Note>
      By design all the node types provided are synchronous in nature.  This is intentionally, specifically with respect to invoking commands and ensuring singular operation.
    </c.Note>

    <c.Section title='Node Types'>
      <NodeList src={nodeContents} />
    </c.Section>

    <c.Section title='Libraries'>
      Some of the more common libraries are provided as the {d.method('d.library')} method.  The purpose of this is to have consistent references to common utilities to help keep external linking simple.
    </c.Section>

    <c.Section title='Modules'>
      You can also link to other {d.library('Travetto')} based modules as needed.  The {d.method('d.mod')} object relies on what is already imported into your project, and reference the package.json of the related module. If the module is not installed, doc generation will fail.
    </c.Section>

    <c.Section title='CLI - doc'>
      The run command allows for generating documentation output.
      <c.Execution title='CLI Doc Help' cmd='trv' args={['doc', '--help']}
        config={{ cwd: './doc-exec' }} />

      By default, running the command will output the {d.library('Markdown')} content directly to the terminal.
      <c.Execution title='Sample CLI Output' cmd='trv' args={['doc', '-o', 'html']}
        config={{ cwd: './doc-exec' }} />
    </c.Section>
  </>;
};