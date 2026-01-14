/** @jsxImportSource @travetto/doc/support */
import { CliCommand } from '@travetto/cli';
import { c, d } from '@travetto/doc';
import { RuntimeResources, toConcrete } from '@travetto/runtime';
import { WebRequest, WebResponse } from '@travetto/web';

import type { WebHttpServer } from './src/types.ts';
import { WebHttpConfig } from './src/config.ts';
import { NodeWebHttpServer } from './src/node.ts';

const WebServerContract = toConcrete<WebHttpServer>();

export const text = <>
  <c.StdHeader />
  This module provides basic for running {d.library('NodeHttp')}. {d.library('NodeHttps')}  and {d.library('NodeHttp2')} servers, along with support for tls key generation during development.

  <c.Section title='Running a Server'>

    By default, the framework provides a default {CliCommand} for {WebServerContract} that will follow default behaviors, and spin up the server.

    <c.Execution title='Standard application' cmd='trv' args={['web:http']} config={{ workingDirectory: './doc-exec', env: { TRV_ROLE: 'doc' } }} />

    <c.SubSection title="Configuration">
      <c.Code title="Standard Web Http Config" src={WebHttpConfig} />
    </c.SubSection>

    <c.SubSection title='Creating a Custom CLI Entry Point'>

      To customize a Web server, you may need to construct an entry point using the {CliCommand} decorator. This could look like:

      <c.Code title='Application entry point for Web Applications' src='doc/cli.web_custom.ts' />

      And using the pattern established in the {d.module('Cli')} module, you would run your program using {d.command('npx trv web:custom')}.

      <c.Execution title='Custom application' cmd='trv' args={['web:custom']} config={{ workingDirectory: './doc-exec' }} />
    </c.SubSection>
  </c.Section>

  <c.Section title='Node Web Http Server'>
    <c.Code title="Implementation" src={NodeWebHttpServer} />

    Current the {NodeWebHttpServer} is the only provided {WebServerContract} implementation.  It supports http/1.1, http/2, and tls, and is the same foundation as used by express, koa, and other popular frameworks.
  </c.Section>

  <c.Section title='Standard Utilities'>
    The module also provides standard utilities for starting http servers programmatically:

    <c.Code title='Web Http Utilities' src='src/http.ts' outline startRe={/^export class /} />

    Specifically, looking at {d.method('buildHandler')},

    <c.Code title='Web Http Utilities' src='src/http.ts' startRe={/^\s+static buildHandler/} endRe={/^\s{2}[}]/} />

    we can see the structure for integrating the server behavior with the {d.module('Web')} module dispatcher:
    <ul>
      <li>Converting the node primitive request to a  {WebRequest}</li>
      <li>Dispatching the request through the framework</li>
      <li>Receiving the {WebResponse} and sending that back over the primitive response.</li>
    </ul>
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
