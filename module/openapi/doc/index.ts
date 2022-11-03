import { d, mod, lib } from '@travetto/doc';

export const text = d`
${d.Header()}

In the ${mod.Rest} module, the controllers and endpoints can be described via decorators, comments, or typings. This only provides the general metadata internally. This is not sufficient to generate a usable API doc, and so this module exists to bridge that gap.

The module is provides an ${lib.OpenAPI} v3.x representation of the API metadata provided via the ${mod.Rest} and ${mod.Schema} modules.

${d.Section('Configuration')}
By installing the dependency, the ${lib.OpenAPI} endpoint is automatically generated and exposed at the root of the application as ${d.Path('/openapi.yml')} or ${d.Path('/openapi.json')} (by default). 

All of the high level configurations can be found in the following structure:

${d.Code('Config: OpenAPI Configuration', 'src/config.ts')}

${d.Section('Spec Generation')}
The framework, when in watch mode, will generate the ${lib.OpenAPI} specification in either ${lib.JSON} or ${lib.YAML}. This module integrates with the file watching paradigm and can regenerate the openapi spec as changes to endpoints and models are made during development.  The output format is defined by the suffix of the output file, ${d.Input('.yaml')} or ${d.Input('.json')}.  

${d.Section('CLI - openapi:spec')}

The module provides a command for the ${mod.Cli} to allow scripting file generation.

${d.Execute('OpenAPI usage', 'trv', ['openapi:spec', '--help'])}

The command will run your application, in non-server mode, to collect all the routes and model information, to produce the ${d.Path('openapi.yml')}.  Once produced, the code will store the output in the specified location.

${d.Note(d`The module supports generating the OpenAPI spec in real-time while listening for changes to routes and models.`)}

${d.Section('CLI - openapi:client')}

The module provides a command for the ${mod.Cli} to allow client generation from the API structure.

${d.Execute('OpenAPI usage', 'trv', ['openapi:client', '--help'])}

This tool relies upon a custom build of ${lib.OpenAPIGenerator}, which supports watching.  This allows for fast responsive client generation as the shape of the API changes.  
`;