/** @jsxImportSource @travetto/doc */
import { CliCommand } from '@travetto/cli';
import { c, d } from '@travetto/doc';
import { toConcrete } from '@travetto/runtime';

import type { WebServer } from './src/types.ts';

const WebServerContract = toConcrete<WebServer>();

export const text = <>
  <c.StdHeader />
  This module provides basic for running {d.library('NodeHttp')} and {d.library('NodeHttps')} servers.  It provides support for ssl key generation during development as well.


  <c.Section title='Running a Server'>

    By default, the framework provides a default {CliCommand} for {WebServerContract} that will follow default behaviors, and spin up the server. Currently, {d.mod('WebNode')} is the only module that provides a compatible {WebServerContract}.

    <c.Execution title='Standard application' cmd='trv' args={['run:web']} config={{
      cwd: './doc-exec'
    }} />

    <c.SubSection title='Creating a Custom CLI Entry Point'>

      To customize a Web server, you may need to construct an entry point using the {CliCommand} decorator. This could look like:

      <c.Code title='Application entry point for Web Applications' src='doc/cli.run_web_custom.ts' />

      And using the pattern established in the {d.mod('Cli')} module, you would run your program using {d.command('npx trv run:web:custom')}.

      <c.Execution title='Custom application' cmd='trv' args={['run:web:custom']} config={{ cwd: './doc-exec' }} />
    </c.SubSection>
  </c.Section>
</>;
