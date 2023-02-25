/* eslint-disable no-regex-spaces */
import { d, lib, mod } from '@travetto/doc';
import { path, RootIndex } from '@travetto/manifest';

export const text = () => d`
${d.Header()}

This module provides the necessary tools to produce deliverable output for ${lib.Travetto} based projects.  The main interaction with this module is through the command line interface, and the operations it provides.  Under the covers, the code bundling is performed by ${lib.Rollup}, with specific configuration to support the frameworks runtime expectations.

There are three primary cli commands for packing your code:
${d.List(
  'pack',
  'pack:zip',
  'pack:docker'
)}

${d.Section('CLI - pack')} 

${d.Execute('Pack usage', 'trv', ['pack', '--help'])}

This command line operation will compile your project, and produce a ready to use workspace as a deliverable. Additionally, you can pass in a file to the ${d.Input('eject-file')} flag that will allow for a script to be produced (base on the host operating system).

Specific to this CLI command, the ${d.Input('output')} field determines where the final folder is written that contains all the compiled source. 

${d.SubSection('Entry Point Configuration')}
Every application requires an entry point to determine execution flow (and in ${lib.Rollup}'s case, tree-shaking as well.).  By default the ${mod.Cli} acts as the entry point.  This bypasses the ${mod.Compiler} intentionally, as the compiler is not available at runtime.

Within the command line, the ${d.Input('args')} are positional arguments that will be passed to the entry point on application run. 

${d.Code('Packing an application run', `
$ npx trv pack run myapp
`)}

Would then produce an executable script, in the output folder, that would look like:

${d.Code('Entry script for Packed application', `
#!/bin/sh
cd $(dirname "$0")
node cli run myapp
`)}

And this entry point would be what is executed by ${lib.Docker}, or whatever deployment mechanism is being used.

${d.SubSection('General Packing Operations')}
Every ${mod.Pack} operation extends from the base command, and that provides some consistent operations that run on every packing command.

${d.List(
  d`${d.Method('clean')} - Empties workspace before beginning, controlled by the ${d.Input('--clean')} flag, defaults to on`,
  d`${d.Method('writeEnv')} - Writes the .env.js files that includes the necessary details to start the application.  This is primarily to identify the location of the manifest file needed to run.`,
  d`${d.Method('writePackageJson')} - Generates the ${lib.PackageJson} with the appropriate module type (${lib.CommonJS} or ${lib.EcmascriptModule}) for interpreting plain ${d.Path('.js')} files`,
  d`${d.Method('writeEntryScript')} - Create the entry script based on the ${d.Input('--entry-command')}, ${d.Input('args')}`,
  d`${d.Method('copyResources')} - Will pull in local ${d.Path('resources/**')} files into the final output`,
  d`${d.Method('primeAppCache')} - Runs ${d.Input('trv run')} to ensure the appropriate files are generated to allow for running the application.  This only applies if the entry point is equivalent to ${d.Input('trv run')}`,
  d`${d.Method('writeManifest')} - Produces the ${d.Input('prod')}-ready manifest that is used at runtime.  Removes all devDependencies from the manifest.json`,
  d`${d.Method('bundle')} - Invokes ${lib.Rollup} with the appropriate file set to produce a single output .js file.  Depending on the module type (${lib.CommonJS} or ${lib.EcmascriptModule}) the build process differs to handle the dynamic loading that application does at runtime.`,
)}

${d.Section('CLI - pack:zip')}

This command is nearly identical to the standard ${d.Input('pack')} operation, except for the ${d.Input('output')} flag.  In this scenario, the ${d.Input('output')} flag determines the location and name of the final zip file. 

${d.Execute('Pack:zip usage', 'trv', ['pack:zip', '--help'])}


${d.Section('CLI - pack:docker')}

This command starts off identical to the standard ${d.Input('pack')} operation, but it contains a few additional flags, and ultimately a few additional operations to support creating of the final ${lib.Docker} image.

${d.Execute('Pack:docker usage', 'trv', ['pack:docker', '--help'])}

The additional flags provided are allow for specifying the base image, the final docker image name (and tags), and which registry to push to (if  any).  Additionally, there are flags for exposing which ports the image should expect to open as well.   When using the ${d.Input('--eject-file')}  flag, the output script will produce the entire Dockerfile output inline, so that it can be easily modified as needed.

In addition to the standard operations, this command adds the following steps:
${d.List(
  d`${d.Method('writeDockerFile')} - Generate the docker file contents`,
  d`${d.Method('pullDockerBaseImage')} - Pull base image, to ensure its available and primed`,
  d`${d.Method('buildDockerContainer')} - Build final container`,
  d`${d.Method('pushDockerContainer')} - Push container with appropriate tags.  Only applies if ${d.Input('--docker-push')} is specified`
)}

${d.Section('Ejected File')}

As indicated, any of the pack operations can be ejected, and produce an output that can be run independent of the pack command.  This is helpful when integrating with more complicated build processes.

${d.Execute('Sample Ejected File', 'trv', ['pack:docker', '-x', '/dev/stdout', 'run', 'rest'], {
  cwd: path.resolve(RootIndex.manifest.workspacePath, 'related/todo-app'),
})}
`;