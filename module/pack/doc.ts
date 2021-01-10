// @ts-check
import { pth, doc as d, mod, Code, inp, Terminal, Section, List, Execute, SubSection, Ordered, Snippet } from '@travetto/doc';

exports.text = d`
${Section('CLI - pack')} 

${Execute('Pack usage', 'travetto', ['pack', '--help'])}

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
  `Compiling - Compiles the code in the new workspace, isolating it from your local development`,
  'Excluding Post-Compile Files - Removes any files that should be excluded, post compilation',
  'Copying Added Content - Adds in any additional content that is not in the standard locations',
  'Removing Empty Folders - Purge all empty folders, recursively',
  'Writng Env.js - Write out the .env.js file with computed any env vars that should be set for the deployed app',
  'Remove Source Maps - If keep source is false, all source maps are purged from your app\'s code',
  'Emptying .ts Files - If keep source is false, all .ts files are emptied, as compilation will not occur at runtime',
)}

${Snippet('Assemble Default Config', 'bin/pack.config.yml', /assemble:/, /[.]d[.]ts/)}

${Execute('Assemble Usage', 'travetto', ['pack:assemble', '--help'])}

${SubSection('CLI - pack:zip')}

Zip is an optional step, that can run post assembly.  The only configuration it currently provides is the ability to specify the output location for the zip file.

${Snippet('Zip Default Config', 'bin/pack.config.yml', /zip:/, /output/)}

${Execute('Zip Usage', 'travetto', ['pack:zip', '--help'])}

${SubSection('Modes')}
Various modules may provide customizations to the default ${pth`pack.config.yml`} to allow for easy integration with the packing process.  A simple example of this is via the ${mod.Rest} module, for how to publish lambda packages.

${Code('Rest, pack.lambda.yml', '@travetto/rest/support/pack.lambda.yml')}

${Terminal('Invoking Pack with Mode', `npx travetto pack <mode>`)}

${SubSection('Configuration')}
By default the following paths are searched for configuration (in the following order):

${Ordered(
  '@travetto/pack/bin/pack.config.yml',
  d`${inp`<mode>`} related pack.*.yml`,
  'pack.config.ya?ml'
)}

Given the ordering, its clear to see that a project can define it's own configuration at the root of the project with ${pth`pack.config.yml`}. Any defaults can be overidden.

${Code('Example pack.config.yml', 'doc/pack.config.yml')}
`;