import * as fs from 'fs';

import { d } from './src/doc';
import { lib } from '.';

type Feature = { text: string, name: string };

function getNodes() {
  const lines = fs.readFileSync('./src/nodes.ts', 'utf8').split(/\n/g);
  let feature: Partial<Feature> | undefined;
  const features: Feature[] = [];
  for (const line of lines) {
    if (/^\s+\/[*]/.test(line)) { // block start
      feature = {};
    } else if (feature && /^\s+[*] [^@]/.test(line)) { // Text line
      feature.text = `${feature.text ?? ''} ${line.replace(/^\s+[*] /, '')}`.trim();
    } else if (feature && /^\s+[A-Z]/.test(line)) {
      feature.name = line.match(/((?:[A-Z][a-z]+)+)/)?.[0];
      features.push(feature as Feature);
      feature = undefined;
    }
  }
  return d.List(
    ...features.sort((a, b) => a.name!.localeCompare(b.name))
      .map(f => d`${d.Method(f.name)} - ${f.text}`)
  );
}

export const text = d`
${d.Header()}

This module provides the ability to generate documentation in ${lib.HTML} and/or ${lib.Markdown}.  The module relies on integrating with the source of the project, and providing a fully referenced code-base.  This allows for automatic updates when code is changed and/or refactored. 

${d.Code('Document Sample', './docs/sample/doc.ts')}

${d.Snippet('Document Context', './src/types.ts', /interface DocumentShape/, /^}/)}

As you can see, you need to export a field named ${d.Field('text')} as the body of the help text. The ${d.Field('text')} field can be either a direct invocation or an async function that returns the expected document output.  

${d.Note('By design all the node types provided are synchronous in nature.  This is intentionally, specifically with respect to invoking commands and ensuring singular operation.')}

${d.Section('Node Types')}

${getNodes()}

${d.Section('Libraries')}

Some of the more common libraries are provided as the ${d.Field('lib')} field.  The purpose of this is to have consistent references to common utilities to help keep external linking simple.


${d.Section('Modules')}

You can also link to other ${lib.Travetto} based modules as needed.  The ${d.Field('mod')} object relies on what is already imported into your project, and reference the package.json of the related module. If the module is not installed, doc generation will fail.

${d.Section('CLI - doc')}

The run command allows for generating documentation output.

${d.Execute('CLI Doc Help', 'trv', ['doc', '--help'])}

By default, running the command will output the ${lib.Markdown} content directly to the terminal.

${d.Execute('Sample CLI Output', 'trv', ['doc', '-i', 'docs/sample/doc.ts', '-f', 'html'])}
`;