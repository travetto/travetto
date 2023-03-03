/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { Injectable } from '@travetto/di';
import { Application } from '@travetto/app';

export const text = <>
  <c.StdHeader />

  The {d.mod('Base')} module provides a simplistic entrypoint to allow for the application to run, but that is not sufficient for more complex applications. This module provides a decorator, {Application} who's job is to register entry points into the application, along with the associated  metadata. <br />

  With the application, the {d.method('run')} method is the entry point that will be invoked post construction of the class. Building off of the {d.mod('Di')}, the {Application} is a synonym for {Injectable}, and inherits all the abilities of dependency injection.  This should allow for setup for any specific application that needs to be run. <br />

  For example:

  <c.Code title='Example of Application target' src='doc/entry-simple.ts' />

  Additionally, the {Application} decorator exposes some additional functionality, which can be used to launch the application.

  <c.Section title='run() Arguments'>
    The arguments specified in the {d.method('run')} method are extracted via code transformation, and are able to be bound when invoking the application.  Whether from the command line or a plugin, the parameters will be mapped to the inputs of {d.method('run')}.  For instance:

    <c.Code title='Simple Entry Point with Parameters' src='doc/domain.ts' />
  </c.Section>

  <c.Section title='CLI - run'>

    The run command allows for invocation of applications as defined by the {Application} decorator.  Additionally, the environment can manually be specified (dev, test, prod).

    <c.Execution title='CLI Run Help' cmd='trv' args={['run', '--help']} config={{ cwd: './doc-exec' }} />

    Running without specifying an application {d.command('trv run')}, will display all the available apps, and would look like:

    <c.Execution title='Sample CLI Output' cmd='trv' args={['run']} config={{ cwd: './doc-exec' }} />

    To invoke the {d.input('simple')} application, you need to pass {d.input('domain')} where port is optional with a default.

    <c.Execution title='Invoke Simple' cmd='trv' args={['run', 'simple-domain', 'my-domain.biz', '4000']}
      config={{ cwd: './doc-exec' }} />
  </c.Section>

  <c.Section title='Type Checking'>

    The parameters to {d.method('run')} will be type checked, to ensure proper evaluation.

    <c.Execution title='Invoke Simple with bad port' cmd='trv' args={['run', 'simple-domain', 'my-domain.biz', 'orange']}
      config={{ cwd: './doc-exec' }} />

    The types are inferred from the {d.method('.run()')} method parameters, but can be overridden in the {Application}
    annotation to support customization. Only primitive types are supported:

    <ul>
      <li>{d.input('number')} - Float or decimal</li>
      <li>{d.input('string')} - Default if no type is specified</li>
      <li>{d.input('boolean')} - true(yes/on/1) and false(no/off/0)</li>
      <li>{d.input('union')} - Type unions of the same type ({d.input('string_a | string_b')} or {d.input('1 | 2 | 3 | 4')})</li>
    </ul>

    Customizing the types is done by name, and allows for greater control:

    <c.Code title='Complex Entry Point with Customization' src='doc/complex.ts' />
  </c.Section>
</>;