/** @jsxImportSource @travetto/doc/support */
import { c, d } from '@travetto/doc';

import { LintCommand } from './support/cli.lint.ts';
import { LintRegisterCommand } from './support/cli.lint_register.ts';

export const text = (
  <>
    <c.StdHeader />
    {d.library('Biome')} is the tool used for linting, formatting, and organizing imports in {d.library('Typescript')} and{' '}
    {d.library('Javascript')} code. This module provides a unified CLI interface and standard linting patterns. In a new project, the first
    thing that will need to be done, post installation, is to create the Biome configuration file.
    <c.CliHelpSection commandClass={LintRegisterCommand}>
      <c.CliHelpExecution commandClass={LintRegisterCommand} config={{ workingDirectory: '.' }} />
      When registration completes, this is the file the linter will use, and any other tooling (e.g. IDEs).
      <c.Code title="Sample configuration" src="../../biome.jsonc" />
    </c.CliHelpSection>
    <c.CliHelpSection commandClass={LintCommand}>
      Once registered, using the linter is as simple as invoking it via the cli:
      <c.Terminal title="Running the Linter" src={`${d.trv} lint`} />
      Or pointing your IDE to reference the registered configuration file.
      <c.CliHelpExecution commandClass={LintCommand} config={{ workingDirectory: '.' }} />
    </c.CliHelpSection>
  </>
);
