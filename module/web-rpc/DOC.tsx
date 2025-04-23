/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { Runtime } from '@travetto/runtime';

export const text = <>
  <c.StdHeader />
  This module allows for a highly focused scenario, of supporting RPC operations within a {d.mod('Web')} application.  The module takes care of producing the appropriate handler for the RPC commands along with the ability to generate the appropriate client to be used to interact with the RPC functionality.  The generated client uses Proxy-based objects, along with {d.library('Typescript')} magic to create a dynamic client that does not rely on generating a lot of code.

  <c.Section title='CLI - web:rpc'>
    The library will create the RPC client in one of three flavors: fetch, fetch + node, angular.

    <c.Execution title='Command Service' cmd='trv' args={['web:rpc', '--help']} config={{ cwd: Runtime.workspace.path }} />
  </c.Section>
</>;
