// @ts-check
import { pth, doc as d, mod, Code, Terminal, Section, List, Execute, SubSection, Ordered, Snippet } from '@travetto/doc';

export const text = d`
${Section('CLI - pack')} 

${Execute('Pack usage', 'trv', ['pack', '--help'])}

This command line operation will compile your project, and produce a ready to use workspace as a deliverable. The pack operation is actually a wrapper around multiple sub-operations that are run in series to produce the desired final structure for deployment.  The currently support operations are:

${List(
  'assemble',
  'zip',
  'docker'
)}

${SubSection('CLI - pack:assemble')}

Assemble is the operation that stages the project's code for deployment.  The assembly process goes through the following operations:

${Ordered(
  'Cleaning Workspace - Cleans workspace to start with an empty workspace',
  'Copying Dependencies - Computes the prod depedencies and copies them into the new workspace',
  'Copying App Content - Copies over application content (src/resources/support/bin)',
  'Excluding Pre-Compile Files - Any files that should be excluded pre-compilation, are removed',
  'Compiling - Compiles the code in the new workspace, isolating it from your local development',
  'Excluding Post-Compile Files - Removes any files that should be excluded, post compilation',
  'Copying Added Content - Adds in any additional content that is not in the standard locations',
  'Removing Empty Folders - Purge all empty folders, recursively',
  'Writng Env.js - Write out the .env.js file with computed any env vars that should be set for the deployed app',
  'Remove Source Maps - If keep source is false, all source maps are purged from your app\'s code',
  'Emptying .ts Files - If keep source is false, all .ts files are emptied, as compilation will not occur at runtime',
)}

${Snippet('Assemble Default Config', 'support/pack.config.ts', /assemble:/, /[.]d[.]ts/)}

${Execute('Assemble Usage', 'trv', ['pack:assemble', '--help'])}

${SubSection('CLI - pack:zip')}

Zip is an optional step, that can run post assembly.  The only configuration it currently provides is the ability to specify the output location for the zip file.

${Snippet('Zip Default Config', 'support/pack.config.ts', /zip:/, /\}/)}

${Execute('Zip Usage', 'trv', ['pack:zip', '--help'])}

${SubSection('Modes')}
Various modules may provide customizations to the default ${pth`pack.config.ts`} to allow for easy integration with the packing process.  A simple example of this is via the ${mod.Rest} module, for how to publish lambda packages.

${Code('Rest, pack.lambda.ts', '@travetto/rest/support/pack.aws-lambda.ts')}

${Terminal('Invoking Pack with Mode', 'npx trv pack <mode>')}

${SubSection('Configuration')}

By default, the configuration consists of two components.
* The default config in ${pth`support/pack.config.ts`} and
* The config selected to execute from the cli

These two configurations will be loaded and layered, with the selected config taking precedence.

${Code('Example pack.config.ts', 'doc/support/pack.config.ts')}
`;