/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { RootIndex } from '@travetto/manifest';
import { Max, Min, Schema, Match, Enum, Integer, Float, Precision, MinLength, MaxLength } from '@travetto/schema';

import { CliCommand } from './src/decorators';

const cfg = { cwd: './doc-exec' };

export const text = <>
  <c.StdHeader />
  The cli module represents the primary entry point for execution within the framework. One of the main goals for this module is extensibility, as adding new entry points is meant to be trivial. The framework leverages this module for exposing all executable tools and entry points.  To see a high level listing of all supported commands, invoke {d.input('trv --help')}

  <c.Execution title='General Usage' cmd='trv' args={['--help']} config={{ cwd: RootIndex.manifest.workspacePath }} />

  This listing is from the {d.library('Travetto')} monorepo, and represents the majority of tools that can be invoked from the command line. <br />

  This module also has a tight integration with the {d.library('TravettoPlugin')}, allowing the editing experience to benefit from the commands defined. The most commonly used commands will be the ones packaged with the framework, but its also very easy to create new commands.  With the correct configuration, these commands will also be exposed within VSCode.<br />


  At it's heart, a cli command is the contract defined by what flags, and what arguments the command supports. Within the framework this requires three criteria to be met:
  <ul>
    <li>The file must be located in the {d.path('support/')} folder, and have a name that matches {d.path('cli.*.ts')}</li>
    <li>The file must be a class that has a main method</li>
    <li>The class must use the {CliCommand} decorator</li>
  </ul>

  <c.Code title='Basic Command' src='doc/cli.basic.ts' />
  <c.Execution title='Basic Command Help' cmd='trv' args={['basic', '-h']} config={cfg} />

  <c.Section title='Command Naming'>
    The file name {d.path('support/cli.<name>.ts')} has a direct mapping to the cli command name.   This hard mapping allows for the framework to be able to know which file to invoke without needing to load all command-related files. <br />

    Examples of mappings:
    <ul>
      <li>{d.path('cli.test.ts')} maps to {d.input('test')}</li>
      <li>{d.path('cli.pack_docker.ts')} maps to {d.input('pack:docker')}</li>
      <li>{d.path('cli.email_template.ts')} maps to {d.input('email:template')}</li>
    </ul>

    The pattern is that underscores(_) translate to colons (:), and the {d.input('cli.')} prefix, and {d.input('.ts')} suffix are dropped.
  </c.Section>

  <c.Section title='Binding Flags'>
    {CliCommand} is a wrapper for {Schema}, and so every class that uses the {CliCommand} decorator is now a full {Schema} class. The fields of the class represent the flags that are available to the command.

    <c.Code title='Basic Command with Flag' src='doc/cli.basic_flag.ts' />
    <c.Execution title='Basic Command with Flag Help' cmd='trv' args={['basic:flag', '-h']} config={cfg} />

    As you can see the command now has the support of a basic boolean flag to determine if the response should be loud or not.  The default value here is undefined/false, and so is an opt-in experience.

    <c.Execution title='Basic Command with Loud Flag' cmd='trv' args={['basic:flag', '--loud']} config={cfg} />

    The {CliCommand} supports the following data types for flags:
    <ul>
      <li>Boolean values</li>
      <li>Number values. The {Integer}, {Float}, {Precision}, {Min} and {Max} decorators help provide additional validation.</li>
      <li>String values. {MinLength}, {MaxLength}, {Match} and {Enum} provide additional constraints</li>
      <li>Date values. The {Min} and {Max} decorators help provide additional validation.</li>
      <li>String lists. Same as String, but allowing multiple values.</li>
      <li>Numeric lists. Same as Number, but allowing multiple values.</li>
    </ul>
  </c.Section>

  <c.Section title='Binding Arguments'>
    The {d.method('main()')} method is the entrypoint for the command, represents a series of parameters. Some will be required, some may be optional.  The arguments support all types supported by the flags, and decorators can be provided using the decorators inline on parameters.     Optional arguments in the method, will be optional at run time, and filled with the provided default values.

    <c.Code title='Basic Command with Arg' src='doc/cli.basic_arg.ts' />
    <c.Execution title='Basic Command' cmd='trv' args={['basic:arg', '-h']} config={cfg} />
    <c.Execution title='Basic Command with Invalid Loud Arg' cmd='trv' args={['basic:arg', '20']} config={cfg} />
    <c.Execution title='Basic Command with Loud Arg > 7' cmd='trv' args={['basic:arg', '8']} config={cfg} />
    <c.Execution title='Basic Command without Arg' cmd='trv' args={['basic:arg']} config={cfg} />

    Additionally, if you provide a field as an array, it will collect all valid values (excludes flags, and any arguments past a {d.input('--')}).

    <c.Code title='Basic Command with Arg List' src='doc/cli.basic_arglist.ts' />
    <c.Execution title='Basic Command' cmd='trv' args={['basic:arglist', '-h']} config={cfg} />
    <c.Execution title='Basic Arg List' cmd='trv' args={['basic:arglist', '10', '5', '3', '9', '8', '1']} config={cfg} />
    <c.Execution title='Basic Arg List with Invalid Number' cmd='trv' args={['basic:arglist', '10', '5', '3', '9', '20', '1']} config={cfg} />
    <c.Execution title='Basic Arg List with Reverse' cmd='trv' args={['basic:arglist', '-r', '10', '5', '3', '9', '8', '1']} config={cfg} />
  </c.Section>

  <c.Section title='Customization'>
    By default, all fields are treated as flags and all parameters of {d.method('main()')} are treated as arguments within the validation process.  Like the standard {Schema} behavior, we can leverage the metadata of the fields/parameters to help provide additional customization/context for the users of the commands.

    <c.Code title='Custom Command with Metadata' src='doc/cli.custom_arg.ts' />
    <c.Execution title='Custom Command Help' cmd='trv' args={['custom:arg', '-h']} config={cfg} />
    <c.Execution title='Custom Command Help with overridden Text' cmd='trv' args={['custom:arg', '10', '-m', 'cUsToM']} config={cfg} />
    <c.Execution title='Custom Command Help with default Text' cmd='trv' args={['custom:arg', '6']} config={cfg} />
  </c.Section>

  <c.Section title='Environment Variable Support'>
    In addition to standard flag overriding (e.g. {d.input('/** @alias -m */')}), the command execution also supports allowing environment variables to provide values (secondary to whatever is passed in on the command line).

    <c.Code title='Custom Command with Env Var' src='doc/cli.custom_env-arg.ts' />
    <c.Execution title='Custom Command Help' cmd='trv' args={['custom:env-arg', '-h']} config={cfg} />
    <c.Execution title='Custom Command Help with default Text' cmd='trv' args={['custom:env-arg', '6']} config={cfg} />
    <c.Execution title='Custom Command Help with overridden Text' cmd='trv' args={['custom:env-arg', '10']} config={{
      ...cfg,
      env: { MESSAGE: 'CuStOm' },
      formatCommand: (cmd, ...args) => `MESSAGE=CuStOm ${cmd} ${args.flat().join(' ')}`
    }} />
    <c.Execution title='Custom Command Help with overridden Text' cmd='trv' args={['custom:env-arg', '7']} config={{
      ...cfg,
      env: { MESSAGE: 'CuStOm' },
      formatCommand: (cmd, ...args) => `MESSAGE=CuStOm ${cmd} ${args.flat().join(' ')}`
    }} />
  </c.Section>

  <c.Section title='VSCode Integration'>
    By default, cli commands do not expose themselves to the VSCode extension, as the majority of them are not intended for that sort of operation.  {d.mod('Rest')} does expose a cli target {d.input('run:rest')} that will show up, to help run/debug a rest application.  Any command can mark itself as being a run target, and will be eligible for running from within the {d.library('TravettoPlugin')}.

    <c.Code title='Simple Run Target' src='doc/cli.run_simple.ts' />

    Also, any command name that starts with {d.input('run:')} (i.e. {d.path('support/cli.run_*.ts')}), will be opted-in to the run behavior unless explicitly disabled.
  </c.Section>

  <c.Section title='Advanced Usage'>

    <c.Code title='Anatomy of a Command' src='src/types.ts' startRe={/CliCommandShape/} endRe={/^\}/} />

    <c.SubSection title='Dependency Injection'>
      If the goal is to run a more complex application, which may include depending on {d.mod('Di')}, we can take a look at {d.mod('Rest')}'s target:

      <c.Code title='Simple Run Target' src='../rest/support/cli.run_rest.ts' />

      As noted in the example above, {d.input('fields')} is specified in this execution, with support for {d.input('module')}, {d.input('env')}, and {d.input('profile')}. These env and profile flags are directly tied to the GlobalEnv flags defined in the {d.mod('Base')} module. <br />

      The {d.input('module')} field is slightly more complex, but is geared towards supporting commands within a monorepo context.  This flag ensures that a module is specified if running from the root of the monorepo, and that the module provided is real, and can run the desired command.  When running from an explicit module folder in the monorepo, the module flag is ignored.
    </c.SubSection>

    <c.SubSection title='Custom Validation'>
      In addition to dependency injection, the command contract also allows for a custom validation function, which will have access to bound command (flags, and args) as well as the unknown arguments. When a command implements this method, any {d.codeLink('CliValidationError', 'src/types.ts', /type CliValidationError/)} errors that are returned will be shared with the user, and fail to invoke the {d.method('main')} method.

      <c.Code title='CliValidationError' src='src/types.ts' startRe={/type CliValidationError/} endRe={/^\}/} />

      A simple example of the validation can be found in the {d.input('doc')} command:
      <c.Code title='Simple Validation Example' src='@travetto/doc/support/cli.doc.ts' startRe={/validate\(/} endRe={/^[ ]{2}\}/} />
    </c.SubSection>
  </c.Section>
</>;