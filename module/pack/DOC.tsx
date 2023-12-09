/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { path, RuntimeIndex } from '@travetto/manifest';

export const text = <>
  <c.StdHeader />
  This module provides the necessary tools to produce deliverable output for {d.library('Travetto')} based projects.  The main interaction with this module is through the command line interface, and the operations it provides.  Under the covers, the code bundling is performed by {d.library('Rollup')}, with specific configuration to support the frameworks runtime expectations. <br />

  There are three primary cli commands for packing your code:
  <ul>
    <li>pack</li>
    <li>pack:zip</li>
    <li>pack:docker</li>
  </ul>

  <c.Section title='CLI - pack'>

    <c.Execution title='Pack usage' cmd='trv' args={['pack', '--help']} />

    This command line operation will compile your project, and produce a ready to use workspace as a deliverable. Additionally, you can pass in a file to the {d.input('eject-file')} flag that will allow for a script to be produced (base on the host operating system). <br />

    Specific to this CLI command, the {d.input('output')} field determines where the final folder is written that contains all the compiled source.

    <c.SubSection title='Entry Point Configuration'>
      Every application requires an entry point to determine execution flow (and in {d.library('Rollup')}'s case, tree-shaking as well.).  By default the {d.mod('Cli')} acts as the entry point.  This bypasses the {d.mod('Compiler')} intentionally, as the compiler is not available at runtime. <br />

      Within the command line, the {d.input('args')} are positional arguments that will be passed to the entry point on application run.

      <c.Code title='Packing an application run' src={`
$ npx trv pack run myapp
`} />

      Would then produce an executable script, in the output folder, that would look like:

      <c.Code title='Entry script for Packed application' src={`
#!/bin/sh
cd $(dirname "$0")
node cli run myapp
`} />

      And this entry point would be what is executed by {d.library('Docker')}, or whatever deployment mechanism is being used.
    </c.SubSection>
    <c.SubSection title='General Packing Operations'>
      Every {d.mod('Pack')} operation extends from the base command, and that provides some consistent operations that run on every packing command.

      <ul>
        <li>{d.method('clean')} - Empties workspace before beginning, controlled by the {d.input('--clean')} flag, defaults to on</li>
        <li>{d.method('writeEnv')} - Writes the .env.js files that includes the necessary details to start the application.  This is primarily to identify the location of the manifest file needed to run.</li>
        <li>{d.method('writePackageJson')} - Generates the {d.library('PackageJson')} with the appropriate module type ({d.library('CommonJS')} or {d.library('EcmascriptModule')}) for interpreting plain {d.path('.js')} files</li>
        <li>{d.method('writeEntryScript')} - Create the entry script based on the {d.input('--entry-command')}, {d.input('args')}</li>
        <li>{d.method('copyResources')} - Will pull in local {d.path('resources/**')} files into the final output</li>
        <li>{d.method('primeAppCache')} - Runs {d.input('trv run')} to ensure the appropriate files are generated to allow for running the application.  This only applies if the entry point is equivalent to {d.input('trv run')}</li>
        <li>{d.method('writeManifest')} - Produces the {d.input('prod')}-ready manifest that is used at runtime.  Removes all devDependencies from the manifest.json</li>
        <li>{d.method('bundle')} - Invokes {d.library('Rollup')} with the appropriate file set to produce a single output .js file.  Depending on the module type ({d.library('CommonJS')} or {d.library('EcmascriptModule')}) the build process differs to handle the dynamic loading that application does at runtime.</li>
      </ul>
    </c.SubSection>
  </c.Section>

  <c.Section title='CLI - pack:zip' >
    This command is nearly identical to the standard {d.input('pack')} operation, except for the {d.input('output')} flag.  In this scenario, the {d.input('output')} flag determines the location and name of the final zip file.

    <c.Execution title='Pack:zip usage' cmd='trv' args={['pack:zip', '--help']} />
  </c.Section>

  <c.Section title='CLI - pack:docker'>

    This command starts off identical to the standard {d.input('pack')} operation, but it contains a few additional flags, and ultimately a few additional operations to support creating of the final {d.library('Docker')} image.

    <c.Execution title='Pack:docker usage' cmd='trv' args={['pack:docker', '--help']} />

    The additional flags provided are allow for specifying the base image, the final docker image name (and tags), and which registry to push to (if  any).  Additionally, there are flags for exposing which ports the image should expect to open as well.   When using the {d.input('--eject-file')}  flag, the output script will produce the entire Dockerfile output inline, so that it can be easily modified as needed. <br />

    In addition to the standard operations, this command adds the following steps:
    <ul>
      <li>{d.method('writeDockerFile')} - Generate the docker file contents</li>
      <li>{d.method('pullDockerBaseImage')} - Pull base image, to ensure its available and primed</li>
      <li>{d.method('buildDockerContainer')} - Build final container</li>
      <li>{d.method('pushDockerContainer')} - Push container with appropriate tags.  Only applies if {d.input('--docker-push')} is specified</li>
    </ul>
  </c.Section>

  <c.Section title='Ejected File'>

    As indicated, any of the pack operations can be ejected, and produce an output that can be run independent of the pack command.  This is helpful when integrating with more complicated build processes.

    <c.Execution title='Sample Ejected File' cmd='trv' args={['pack:docker', '-x', '/dev/stdout', 'run:rest']} config={{
      cwd: path.resolve(RuntimeIndex.manifest.workspacePath, 'related/todo-app'),
    }} />
  </c.Section>
</>;