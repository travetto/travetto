/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  In the {d.module('Web')} module, the controllers and endpoints can be described via decorators, comments, or typings. This only provides the general metadata internally. This is not sufficient to generate a usable API doc, and so this module exists to bridge that gap. <br />

  The module is provides an {d.library('OpenAPI')} v3.x representation of the API metadata provided via the {d.module('Web')} and {d.module('Schema')} modules.

  <c.Section title='Configuration'>
    By installing the dependency, the {d.library('OpenAPI')} endpoint is automatically generated and exposed at the root of the application as {d.path('/openapi.yml')} or {d.path('/openapi.json')} (by default). <br />

    All of the high level configurations can be found in the following structure:

    <c.Code title='Config: OpenAPI Configuration' src='src/config.ts' />
  </c.Section>
  <c.Section title='Spec Generation'>
    The framework, when in watch mode, will generate the {d.library('OpenAPI')} specification in either {d.library('JSON')} or {d.library('YAML')}. This module integrates with the file watching paradigm and can regenerate the openapi spec as changes to endpoints and models are made during development.  The output format is defined by the suffix of the output file, {d.input('.yaml')} or {d.input('.json')}.
  </c.Section>
  <c.Section title='CLI - openapi:spec'>

    The module provides a command for the {d.module('Cli')} to allow scripting file generation.

    <c.Execution title='OpenAPI usage' cmd='trv' args={['openapi:spec', '--help']} />

    The command will run your application, in non-server mode, to collect all the endpoints and model information, to produce the {d.path('openapi.yml')}.  Once produced, the code will store the output in the specified location.

    <c.Note>The module supports generating the OpenAPI spec in real-time while listening for changes to endpoints and models.</c.Note>
  </c.Section>
  <c.Section title='CLI - openapi:client'>

    The module provides a command for the {d.module('Cli')} to allow client generation from the API structure.

    <c.Execution title='OpenAPI usage' cmd='trv' args={['openapi:client', '--help']} />

    This tool relies upon a custom build of {d.library('OpenAPIGenerator')}, which supports watching.  This allows for fast responsive client generation as the shape of the API changes.
  </c.Section>
</>;