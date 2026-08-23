/** @jsxImportSource @travetto/doc/support */
import { c, d } from '@travetto/doc';

import { LintCheckCommand } from './support/cli.lint_check.ts';
import { LintFormatCommand } from './support/cli.lint_format.ts';
import { LintRegisterCommand } from './support/cli.lint_register.ts';
import { LintSpellCommand } from './support/cli.lint_spell.ts';

export const text = (
  <>
    <c.StdHeader />
    {d.library('Oxlint')}, {d.library('Oxfmt')}, and {d.library('CSpell')} are the tools used for linting, formatting, and spell checking in{' '}
    {d.library('Typescript')} and {d.library('Javascript')} code. This module provides a unified CLI interface and standard linting,
    formatting, and spell checking configurations. In a new project, the first thing that will need to be done, post installation, is to
    register the configuration files.
    <c.CliHelpSection commandClass={LintRegisterCommand}>
      <c.CliHelpExecution commandClass={LintRegisterCommand} config={{ workingDirectory: '.' }} />
      When registration completes, this bootstraps the configuration files the linter, formatter, and spell checker will use, as well as
      editor tooling (e.g. IDEs).
    </c.CliHelpSection>
    <c.CliHelpSection commandClass={LintCheckCommand}>
      Linting is performed via the check command:
      <c.Terminal title="Running the Linter" src={`${d.trv} lint:check`} />
      <c.CliHelpExecution commandClass={LintCheckCommand} config={{ workingDirectory: '.' }} />
    </c.CliHelpSection>
    <c.CliHelpSection commandClass={LintFormatCommand}>
      Formatting is performed via the format command:
      <c.Terminal title="Running the Formatter" src={`${d.trv} lint:format`} />
      <c.CliHelpExecution commandClass={LintFormatCommand} config={{ workingDirectory: '.' }} />
    </c.CliHelpSection>
    <c.CliHelpSection commandClass={LintSpellCommand}>
      Spell checking is performed via the spell command:
      <c.Terminal title="Running the Spell Checker" src={`${d.trv} lint:spell`} />
      <c.CliHelpExecution commandClass={LintSpellCommand} config={{ workingDirectory: '.' }} />
    </c.CliHelpSection>
  </>
);
