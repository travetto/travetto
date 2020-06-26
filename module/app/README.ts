import { Injectable as InjectableDec } from '@travetto/di';
import { Application as AppDec } from '.';

import { Docs, run, mod, decorator, method, code, command, terminal, input, read } from '@travetto/doc';

const Application = decorator(AppDec);
const Injectable = decorator(InjectableDec);

Docs(__dirname, 'Application')(`
  The ${mod('base')} module provides a simplistic entrypoint to allow for the application to run, but that is not sufficient for more complex applications. 
  This module provides a decorator, ${Application} who's job is to register entry points into the application, along with the associated 
  metadata. 
  
  With the application, the ${method('run')} method is the entry point that will be invoked post construction of the class. Building off of the ${mod('di')}, 
  the ${Application} is a synonym for ${Injectable}, and inherits all the abilities of dependency injection.  This should 
  allow for setup for any specific application that needs to be run.
  
  For example:
  
  ${code(`Example of ${Application} target`, read('alt/simple/src/entry.ts'))}
  
  Additionally, the ${Application} decorator exposes some additional functionality, which can be used to launch the application. 
  
  ## ${method('.run()')} Arguments
  
  The arguments specified in the ${method('run')} method are extracted via code transformation, and are able to be bound when invoking the application.  
  Whether from the command line or a plugin, the parameters will be mapped to the inputs of ${method('run')}.  For instance:
  
  ${code('Simple Entry Point with Parameters', read('alt/simple/src/domain.ts'))}
  
  These command line invocation of ${command('travetto', 'run')} would look like:
  
  ${terminal('Sample CLI Output', run('travetto', 'run'))}
  
  To invoke the ${input('simple')} application, you need to pass ${input('domain')} where port is optional with a default.
  
  ${terminal('Invoke Simple', run('travetto', 'run', 'simple-domain', 'mydomain.biz', '4000'))}
  
  ## Type Checking
  
  The parameters to ${method('run')} will be type checked, to ensure proper evaluation.
  
  ${terminal('Invoke Simple with bad port', run('travetto', 'run', 'simple-domain', 'mydomain.biz', 'orange'))}
  
  The types are inferred from the ${method(`.run()`)} method parameters, but can be overridden in the ${Application} 
  annotation to support customization. Only primitive types are supported:
  
  * ${input(`number`)} - Float or decimal
  * ${input(`string`)} - Default if no type is specified
  * ${input(`boolean`)} - true(yes/on/1) and false(no/off/0)
  * ${input(`union`)} - Type unions of the same type (${input(`string_a | string_b`)} or ${input(`1 | 2 | 3 | 4`)})
  
  Customizing the types is done by name, and allows for greater control:
  
  ${code('Complex Entry Point with Customization', read('alt/example/src/complex.ts'))}
`);