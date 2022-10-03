/* eslint-disable no-regex-spaces */
import { d, mod } from '@travetto/doc';

export const text = d`
${d.Header()}

${d.Section('CLI - pack')} 

${d.Execute('Pack usage', 'trv', ['pack', '--help'])}

This command line operation will compile your project, and produce a ready to use workspace as a deliverable. The pack operation is actually a wrapper around multiple sub-operations that are run in series to produce the desired final structure for deployment.  The currently support operations are:

${d.List(
  'assemble',
  'zip',
  'docker'
)}

${d.SubSection('CLI - pack:assemble')}

Assemble is the operation that stages the project's code for deployment.  The assembly process goes through the following operations:

${d.Ordered(
  'Cleaning Workspace - Cleans workspace to start with an empty workspace',
  'Copying Dependencies - Computes the prod dependencies and copies them into the new workspace',
  'Copying App Content - Copies over application content (src/, resources/, support/, bin/)',
  'Excluding Pre-Compile Files - Any files that should be excluded pre-compilation, are removed',
  'Compiling - Compiles the code in the new workspace, isolating it from your local development',
  'Excluding Post-Compile Files - Removes any files that should be excluded, post compilation',
  'Copying Added Content - Adds in any additional content that is not in the standard locations',
  'Removing Empty Folders - Purge all empty folders, recursively',
  'Writing Env.js - Write out the .env.js file with computed any env vars that should be set for the deployed app',
  'Remove Source Maps - If keep source is false, all source maps are purged from your app\'s code',
  'Emptying .ts Files - If keep source is false, all .ts files are emptied, as compilation will not occur at runtime',
)}

${d.Snippet('Assemble Default Config', 'support/pack.config.ts', /assemble:/, /[.]d[.]ts/)}

${d.Execute('Assemble Usage', 'trv', ['pack:assemble', '--help'])}

${d.SubSection('CLI - pack:zip')}

Zip is an optional step, that can run post assembly.  The only configuration it currently provides is the ability to specify the output location for the zip file.

${d.Snippet('Zip Default Config', 'support/pack.config.ts', /zip:/, /\}/)}

${d.Execute('Zip Usage', 'trv', ['pack:zip', '--help'])}

${d.SubSection('CLI - pack:docker')}

Docker support is an optional step, that can run post assembly.  This allows for building a docker image, and currently only supports the base images as the only configuration options.

${d.Snippet('Docker Default Config', 'support/pack.config.ts', /docker:/, /\}/)}

${d.Execute('Docker Usage', 'trv', ['pack:docker', '--help'])}


${d.SubSection('Modes')}
Various modules may provide customizations to the default ${d.Path('pack.config.ts')} to allow for easy integration with the packing process.  A simple example of this is via the ${mod.Rest} module, for how to publish lambda packages.

${d.Code('Rest, pack.lambda.ts', '@travetto/rest-aws-lambda/support/pack.aws-lambda.ts')}

${d.Terminal('Invoking Pack with Mode', 'npx trv pack <mode>')}

${d.Section('Configuration')}

By default, the configuration consists of two components.
${d.List(
  d`The default config in ${d.Path('support/pack.config.ts')} and`,
  'The config selected to execute from the cli'
)}

These two configurations will be loaded and layered, with the selected config taking precedence.

${d.Code('Example pack.config.ts', 'doc/support/pack.config.ts')}

${d.SubSection('Environment Override')}

When working with sub operations, passing command-line flags is challenging.  To support a more natural usage, the sub operations 
allow their key parameters to be overridden via environment variables.

${d.Snippet('Assemble Overrides', './support/bin/assemble/operation.ts', /^  overrides:/, /^  [}]/)}
${d.Snippet('Docker Overrides', './support/bin/docker.ts', /^  overrides:/, /^  [}]/)}
${d.Snippet('Zip Overrides', './support/bin/zip.ts', /^  overrides:/, /^  [}]/)}
`;