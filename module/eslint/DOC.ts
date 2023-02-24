import { d, lib } from '@travetto/doc';

export const text = () => d`
${d.Header()}

${lib.Eslint} is the standard for linting ${lib.Typescript} and ${lib.Javascript} code.  This module provides some standard linting patterns and the ability to create custom rules. Due to the fact that the framework supports both ${lib.CommonJS} and ${lib.EcmascriptModule} formats, a novel solution was required to allow ${lib.Eslint} to load ${lib.EcmascriptModule} files.  

${d.Note(d`
The ${lib.Eslint} has introduced ${d.Library('a new configuration format', 'https://eslint.org/blog/2022/08/new-config-system-part-3/')} which allows for ${lib.EcmascriptModule} files.
`)}

${d.Section('CLI - Register')}
In a new project, the first thing that will need to be done, post installation, is to create the eslint configuration file.  

${d.Execute('Registering the Configuration', 'trv', ['lint:register'])}

This is the file the linter will use, and any other tooling (e.g. IDEs).  

${d.Code('Sample configuration', '../../eslint.config.js')}

The output is tied to whether or not you are using the ${lib.CommonJS} or ${lib.EcmascriptModule} format.

${d.Section('CLI - Lint')}

Once installed, using the linter is as simple as invoking it via the cli:

${d.Terminal('Running the Linter', 'npx trv lint')}

Or pointing your IDE to reference the registered configuration file.

${d.Section('Custom Rules')}
It can be seen in the sample configuration, that the configuration is looking for files with the pattern of ${d.Path('support/eslint/.*')}

These files will follow a given pattern of: 

${d.Snippet('Custom Rule Shape', '@travetto/eslint/support/bin/types.ts', /./)}

An example plugin is used in the ${lib.Travetto} framework for enforcing import patterns:

${d.Snippet('Import Order Rule', '../../support/eslint.import-order.ts', /./)}
`;