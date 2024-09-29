/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { Runtime } from '@travetto/runtime';

export const text = <>
  <c.StdHeader />
  This module allows for a highly focused scenario, of producing {d.library('Typescript')}-based clients for use within a homogenous ecosystem.  If a more general/robust solution is needed, {d.mod('Openapi')} operates with the the full generative abilities provided by {d.library('OpenAPI')}'s client generation tools. <br />

  The primary benefit with this approach is faster code generation times, as well as no longer having a dependency on {d.library('Docker')} during generation.  This results in far less system resources, along with a more responsive rendering process.

  <c.Section title='CLI - rest:client'>
    The library, in addition to generating client output at runtime, also allows for direct generation of clients, regardless of any configurations defined in the application's configuration files.

    <c.Execution title='Command Service' cmd='trv' args={['rest:client', '--help']} config={{ cwd: Runtime.workspace.path }} />
  </c.Section>
</>;
