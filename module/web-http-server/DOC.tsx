/** @jsxImportSource @travetto/doc */
import { CliCommand } from '@travetto/cli';
import { c, d } from '@travetto/doc';
import { RuntimeResources, toConcrete } from '@travetto/runtime';

import type { WebHttpServer } from './src/types.ts';
import { WebHttpConfig } from './src/config.ts';
import { DefaultWebServer } from './src/default.ts';

const WebServerContract = toConcrete<WebHttpServer>();

export const text = <>
  <c.StdHeader />
  This module provides basic support for running {d.library('NodeHttp')}, {d.library('NodeHttps')} and {d.library('NodeHttp2')} servers, along support for ssl key generation during development.

  <c.Section title='Default Server'>
    <c.Code title="Node Web Server" src={DefaultWebServer}></c.Code>
    This module provides a default implementation of the {WebServerContract} interface, which is used by the framework to run a web server. This is a production ready server built around {d.library('Node')}'s built in http support.
  </c.Section>

  <c.Section title="Configuration">
    <c.Code title="Standard Web Http Config" src={WebHttpConfig} />
    This configuration points to the specific controls you may want while running an http server.
  </c.Section>

  <c.Section title='Running a Server'>
    By default, the framework provides a default {CliCommand} for {WebServerContract} that will follow default behaviors, and spin up the server.

    <c.Execution title='Standard application' cmd='trv' args={['web:http']} config={{
      cwd: './doc-exec'
    }} />

    <c.SubSection title='Creating a Custom CLI Entry Point'>

      To customize a Web server, you may need to construct an entry point using the {CliCommand} decorator. This could look like:

      <c.Code title='Application entry point for Web Applications' src='doc/cli.web_custom.ts' />

      And using the pattern established in the {d.mod('Cli')} module, you would run your program using {d.command('npx trv web:custom')}.

      <c.Execution title='Custom application' cmd='trv' args={['web:custom']} config={{ cwd: './doc-exec' }} />
    </c.SubSection>
  </c.Section>

  <c.Section title='TLS Support'>
    Additionally the framework supports TLS out of the box, by allowing you to specify your public and private keys for the cert.  In dev mode, the framework will also automatically generate a self-signed cert if:

    <ul>
      <li>TLS support is configured</li>
      <li>{d.library('NodeForge')} is installed</li>
      <li>Not running in prod</li>
      <li>No keys provided</li>
    </ul>

    This is useful for local development where you implicitly trust the cert. <br />

    TLS support can be enabled by setting {d.input('web.http.tls: true')} in your config. The key/cert can be specified as string directly in the config file/environment variables.  The key/cert can also be specified as a path to be picked up by {RuntimeResources}.
  </c.Section>
</>;
