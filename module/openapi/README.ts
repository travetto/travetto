import { d, Mod, Library, Section, inp, pth, Code } from '@travetto/doc';

const OpenAPI = Library('OpenAPI', 'https://github.com/OAI/OpenAPI-Specification')


export default d`
In the ${Mod('rest')} module, the controllers and endpoints can be described via decorators, comments, or typings. This only provides the general metadata internally. This is not sufficient to generate a usable API doc, and so this module exists to bridge that gap.

The module is provides an ${OpenAPI} v3.x representation of the API metadata provided via the ${Mod('rest')} and ${Mod('schema')} modules.

${Section('Configuration')}
By installing the dependency, the ${OpenAPI} endpoint is automatically generated and exposed at the root of the application as ${pth`/openapi.yml`} or ${pth`/openapi.json`} (by default). 

All of the high level configurations can be found in the following structure:

${Code('Config: OpenAPI Configuration', './src/config.ts')}

${Section('Spec Generation')}
The framework, when in watch mode, will generate the ${OpenAPI} specification in either ${Library('JSON', 'https://www.json.org')} or ${Library('YAML', 'https://yaml.org/')}. This module integrates with the file watching paradigm and can regenerate the openapi spec as changes to endpoints and models are made during development.  The output format is defined by the suffix of the output file, ${inp`.yaml`} or ${inp`.json`}.  

The module provides a plugin for the ${Mod('cli')} to allow scripting file generation.

${Section('Client Generation')}
The outputted spec can be consumed using the ${Library('OpenAPI client generation tools', 'https://github.com/OpenAPITools/openapi-generator')}.
`;