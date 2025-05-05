/** @jsxImportSource @travetto/doc */
import { CliCommand } from '@travetto/cli';
import { c, d } from '@travetto/doc';
import { RuntimeResources, toConcrete } from '@travetto/runtime';

import type { WebHttpServer } from './src/types.ts';
import { WebHttpConfig } from './src/config.ts';

const WebServerContract = toConcrete<WebHttpServer>();

export const text = <>
  <c.StdHeader />
  This module provides basic for running {d.library('NodeHttp')} and {d.library('NodeHttps')} servers.  It provides support for ssl key generation during development as well.

  <c.Section title='Running a Server'>

    By default, the framework provides a default {CliCommand} for {WebServerContract} that will follow default behaviors, and spin up the server. Currently, {d.mod('WebNode')} is the only module that provides a compatible {WebServerContract}.

    <c.Execution title='Standard application' cmd='trv' args={['web:http']} config={{
      cwd: './doc-exec'
    }} />

    <c.SubSection title="Configuration">
      <c.Code title="Standard Web Http Config" src={WebHttpConfig} />
    </c.SubSection>

    <c.SubSection title='Creating a Custom CLI Entry Point'>

      To customize a Web server, you may need to construct an entry point using the {CliCommand} decorator. This could look like:

      <c.Code title='Application entry point for Web Applications' src='doc/cli.web_custom.ts' />

      And using the pattern established in the {d.mod('Cli')} module, you would run your program using {d.command('npx trv web:custom')}.

      <c.Execution title='Custom application' cmd='trv' args={['web:custom']} config={{ cwd: './doc-exec' }} />
    </c.SubSection>
  </c.Section>

  <c.Section title='SSL Support'>
    Additionally the framework supports SSL out of the box, by allowing you to specify your public and private keys for the cert.  In dev mode, the framework will also automatically generate a self-signed cert if:

    <ul>
      <li>SSL support is configured</li>
      <li>{d.library('NodeForge')} is installed</li>
      <li>Not running in prod</li>
      <li>No keys provided</li>
    </ul>

    This is useful for local development where you implicitly trust the cert. <br />

    SSL support can be enabled by setting {d.input('web.http.ssl: true')} in your config. The key/cert can be specified as string directly in the config file/environment variables.  The key/cert can also be specified as a path to be picked up by {RuntimeResources}.
  </c.Section>
</>;
