import { doc as d, Code, Command, inp, Section, List, meth, Execute, mod, Header } from '@travetto/doc';
import { Injectable } from '@travetto/di';

import { Application } from '.';

export const text = d`
${Header()}

The ${mod.Base} module provides a simplistic entrypoint to allow for the application to run, but that is not sufficient for more complex applications. This module provides a decorator, ${Application} who's job is to register entry points into the application, along with the associated  metadata. 

With the application, the ${meth`run`} method is the entry point that will be invoked post construction of the class. Building off of the ${mod.Di}, the ${Application} is a synonym for ${Injectable}, and inherits all the abilities of dependency injection.  This should allow for setup for any specific application that needs to be run.

For example:

${Code(d`Example of ${Application.name} target`, 'doc/entry-simple.ts')}

Additionally, the ${Application} decorator exposes some additional functionality, which can be used to launch the application.

${Section(d`${meth`.run()`} Arguments`)}
The arguments specified in the ${meth`run`} method are extracted via code transformation, and are able to be bound when invoking the application.  Whether from the command line or a plugin, the parameters will be mapped to the inputs of ${meth`run`}.  For instance:
  
${Code(d`Simple Entry Point with Parameters`, 'doc/domain.ts')}

${Section('CLI - run')}

The run command allows for invocation of applications as defined by the ${Application} decorator.  Additionally, the environment can manually be specified (dev, test, prod).

${Execute('CLI Run Help', 'trv', ['run', '--help'])}

Running without specifying an application ${Command('trv', 'run')}, will display all the available apps, and would look like:

${Execute('Sample CLI Output', 'trv', ['run'])}

To invoke the ${inp`simple`} application, you need to pass ${inp`domain`} where port is optional with a default.
  
${Execute('Invoke Simple', 'trv', ['run', 'simple-domain', 'mydomain.biz', '4000'], {
  env: { TRV_SRC_LOCAL: 'doc' }
})}

${Section('Type Checking')}

The parameters to ${meth`run`} will be type checked, to ensure proper evaluation.

${Execute('Invoke Simple with bad port', 'trv', ['run', 'simple-domain', 'mydomain.biz', 'orange'], {
  env: { TRV_SRC_LOCAL: 'doc' }
})}

The types are inferred from the ${meth`.run()`} method parameters, but can be overridden in the ${Application} 
annotation to support customization. Only primitive types are supported:

${List(
  d`${inp`number`} - Float or decimal`,
  d`${inp`string`} - Default if no type is specified`,
  d`${inp`boolean`} - true(yes/on/1) and false(no/off/0)`,
  d`${inp`union`} - Type unions of the same type (${inp`string_a | string_b`} or ${inp`1 | 2 | 3 | 4`})`
)}
  
Customizing the types is done by name, and allows for greater control:
  
${Code('Complex Entry Point with Customization', 'doc/complex.ts')}
`;