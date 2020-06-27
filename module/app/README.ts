import { Injectable } from '@travetto/di';
import { Application } from '.';

import { docs, Mod, Method, Code, Command, Terminal, Input, Section } from '@travetto/doc';

docs`
The ${Mod('base')} module provides a simplistic entrypoint to allow for the application to run, but that is not sufficient for more complex applications. 
This module provides a decorator, ${Application} who's job is to register entry points into the application, along with the associated 
metadata. 

With the application, the ${Method('run')} method is the entry point that will be invoked post construction of the class. Building off of the ${Mod('di')}, 
the ${Application} is a synonym for ${Injectable}, and inherits all the abilities of dependency injection.  This should 
allow for setup for any specific application that needs to be run.

For example:

${Code(`Example of ${Application} target`, 'alt/simple/src/entry.ts')}

Additionally, the ${Application} decorator exposes some additional functionality, which can be used to launch the application.

${Section(`${Method('.run()')} Arguments`)}
The arguments specified in the ${Method('run')} method are extracted via code transformation, and are able to be bound when invoking the application.  
Whether from the command line or a plugin, the parameters will be mapped to the inputs of ${Method('run')}.  For instance:
  
${Code('Simple Entry Point with Parameters', 'alt/simple/src/domain.ts')}

These command line invocation of ${Command('travetto', 'run')} would look like:

${Terminal('Sample CLI Output',
  'travetto', 'run')}

To invoke the ${Input('simple')} application, you need to pass ${Input('domain')} where port is optional with a default.
  
${Terminal('Invoke Simple',
    'travetto', 'run', 'simple-domain', 'mydomain.biz', '4000')}

${Section(`Type Checking`)}

The parameters to ${Method('run')} will be type checked, to ensure proper evaluation.

${Terminal('Invoke Simple with bad port',
      'travetto', 'run', 'simple-domain', 'mydomain.biz', 'orange')}

The types are inferred from the ${Method(`.run()`)} method parameters, but can be overridden in the ${Application} 
annotation to support customization. Only primitive types are supported:

* ${Input(`number`)} - Float or decimal
* ${Input(`string`)} - Default if no type is specified
* ${Input(`boolean`)} - true(yes/on/1) and false(no/off/0)
* ${Input(`union`)} - Type unions of the same type (${Input(`string_a | string_b`)} or ${Input(`1 | 2 | 3 | 4`)})

Customizing the types is done by name, and allows for greater control:
  
${Code('Complex Entry Point with Customization', 'alt/example/src/complex.ts')}
`;