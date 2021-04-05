import { d, mod } from '@travetto/doc';
import { Injectable } from '@travetto/di';

import { Application } from '.';

export const text = d`
${d.Header()}

The ${mod.Base} module provides a simplistic entrypoint to allow for the application to run, but that is not sufficient for more complex applications. This module provides a decorator, ${Application} who's job is to register entry points into the application, along with the associated  metadata. 

With the application, the ${d.Method('run')} method is the entry point that will be invoked post construction of the class. Building off of the ${mod.Di}, the ${Application} is a synonym for ${Injectable}, and inherits all the abilities of dependency injection.  This should allow for setup for any specific application that needs to be run.

For example:

${d.Code(d`Example of ${Application.name} target`, 'doc/entry-simple.ts')}

Additionally, the ${Application} decorator exposes some additional functionality, which can be used to launch the application.

${d.Section(d`${d.Method('.run()')} Arguments`)}
The arguments specified in the ${d.Method('run')} method are extracted via code transformation, and are able to be bound when invoking the application.  Whether from the command line or a plugin, the parameters will be mapped to the inputs of ${d.Method('run')}.  For instance:
  
${d.Code(d`Simple Entry Point with Parameters`, 'doc/domain.ts')}

${d.Section('CLI - run')}

The run command allows for invocation of applications as defined by the ${Application} decorator.  Additionally, the environment can manually be specified (dev, test, prod).

${d.Execute('CLI Run Help', 'trv', ['run', '--help'])}

Running without specifying an application ${d.Command('trv', 'run')}, will display all the available apps, and would look like:

${d.Execute('Sample CLI Output', 'trv', ['run'])}

To invoke the ${d.Input('simple')} application, you need to pass ${d.Input('domain')} where port is optional with a default.
  
${d.Execute('Invoke Simple', 'trv', ['run', 'simple-domain', 'mydomain.biz', '4000'], {
  env: { TRV_SRC_LOCAL: 'doc' }
})}

${d.Section('Type Checking')}

The parameters to ${d.Method('run')} will be type checked, to ensure proper evaluation.

${d.Execute('Invoke Simple with bad port', 'trv', ['run', 'simple-domain', 'mydomain.biz', 'orange'], {
  env: { TRV_SRC_LOCAL: 'doc' }
})}

The types are inferred from the ${d.Method('.run()')} method parameters, but can be overridden in the ${Application} 
annotation to support customization. Only primitive types are supported:

${d.List(
  d`${d.Input('number')} - Float or decimal`,
  d`${d.Input('string')} - Default if no type is specified`,
  d`${d.Input('boolean')} - true(yes/on/1) and false(no/off/0)`,
  d`${d.Input('union')} - Type unions of the same type (${d.Input('string_a | string_b')} or ${d.Input('1 | 2 | 3 | 4')})`
)}
  
Customizing the types is done by name, and allows for greater control:

${d.Code('Complex Entry Point with Customization', 'doc/complex.ts')}
`;