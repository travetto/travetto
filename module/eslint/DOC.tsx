/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  {d.library('Eslint')} is the standard for linting {d.library('Typescript')} and {d.library('Javascript')} code.  This module provides some standard linting patterns and the ability to create custom rules. Due to the fact that the framework supports both {d.library('CommonJS')} and {d.library('EcmascriptModule')} formats, a novel solution was required to allow {d.library('Eslint')} to load {d.library('EcmascriptModule')} files.

  <c.Note>
    The {d.library('Eslint')} has introduced <c.Ref title='a new configuration format' href='https://eslint.org/blog/2022/08/new-config-system-part-3/' /> which allows for {d.library('EcmascriptModule')} files.
  </c.Note>

  <c.Section title='CLI - Register'>
    In a new project, the first thing that will need to be done, post installation, is to create the eslint configuration file.

    <c.Execution title='Registering the Configuration' cmd='trv' args={['eslint:register']} />

    This is the file the linter will use, and any other tooling (e.g. IDEs).

    <c.Code title='Sample configuration' src='../../eslint.config.cjs' />

    The output is tied to whether or not you are using the {d.library('CommonJS')} or {d.library('EcmascriptModule')} format.
  </c.Section>

  <c.Section title='CLI - Lint'>

    Once installed, using the linter is as simple as invoking it via the cli:

    <c.Terminal title='Running the Linter' src='npx trv eslint' />

    Or pointing your IDE to reference the registered configuration file.
  </c.Section>

  <c.Section title='Custom Rules'>
    It can be seen in the sample configuration, that the configuration is looking for files with the pattern of {d.path('support/eslint/.*')} <br />

    These files will follow a given pattern of:

    <c.Code title='Custom Rule Shape' src='@travetto/eslint/support/bin/types.ts' startRe={/./} />

    An example plugin is used in the {d.library('Travetto')} framework for enforcing import patterns:

    <c.Code title='Import Order Rule' src='../../support/eslint.import-order.ts' startRe={/./} />
  </c.Section>
</>;