import { d, mod, lib } from '@travetto/doc';
import { Field, Schema } from '@travetto/schema';

import { Config as ConfigDec } from './src/decorator';

const ConfigLink = d.Ref('ConfigManager', './src/manager.ts');

export const text = d`
${d.Header()}

The config module provides support for loading application config on startup. Configuration values support the common ${lib.YAML} constructs as defined in ${mod.Yaml}.  Additionally, the configuration is built upon the ${mod.Schema} module, to enforce type correctness, and allow for validation of configuration as an 
entrypoint into the application.  Given that all ${ConfigDec} classes are ${Schema}-based classes, all the standard ${Schema} and ${Field} functionality applies.


${d.Section('Resolution')}

The configuration information is comprised of:

${d.List(
  d`${lib.YAML} files`,
  d`environment variables`,
  d`configuration classes`
)}

Config loading follows a defined resolution path, below is the order in increasing specificity:
${d.Ordered(
  d`${d.Path('resources/application.yml')} - Load the default ${d.Path('application.yml')} if available.`,
  d`${d.Path('resources/*.yml')} - Load profile specific configurations as defined by the values in ${d.Field('process.env.TRV_PROFILES')}`,
  d`${d.Path('resources/{env}.yml')} - Load environment specific profile configurations as defined by the values of ${d.Field('process.env.TRV_ENV')}.`,
  d`${d.Field('process.env')} - Read startup configuration from environment to allow for overriding any values. Because we are overriding a ${lib.YAML} based configuration we need to compensate for the differences in usage patterns.  Generally all environment variables are passed in as ${d.Input('UPPER_SNAKE_CASE')}. When reading from ${d.Field('process.env')} we will map ${d.Input('UPPER_SNAKE_CASE')} to ${d.Input('upper.snake.case')}, and will attempt to match by case-insensitive name.`
)}

By default all configuration data is inert, and will only be applied when constructing an instance of a configuration class. This is due to the fact that environment data, as well as configuration data can only be interpreted in light of a class structure, as the data binding is what makes the configuration valid.

${d.Section('A Complete Example')}

A more complete example setup would look like:

${d.Config('resources/application.yml', 'doc/resources/application.yml')}

${d.Config('resources/prod.yml', 'doc/resources/prod.yml')}

with environment variables

${d.Config('Environment variables', 'doc/resources/env.properties', 'properties')}

At runtime the resolved config would be:

${d.Execute('Runtime Resolution', 'doc/resolve.ts', [], { module: 'boot' })}

${d.Section('Secrets')}
By default, when in production mode, the application startup will request redacted secrets to log out.  These secrets follow a standard set of rules, but can be amended by listing regular expressions under ${d.Input('config.redacted')}.

${d.Section('Consuming')}
The ${ConfigLink} service provides direct access to all of the loaded configuration. For simplicity, a decorator, ${ConfigDec} allows for classes to automatically be bound with config information on post construction via the ${mod.Di} module. The decorator will install a ${d.Method('postConstruct')} method if not already defined, that performs the binding of configuration.  This is due to the fact that we cannot rewrite the constructor, and order of operation matters.

The decorator takes in a namespace, of what part of the resolved configuration you want to bind to your class. Given the following class:

${d.Code('Database config object', 'doc/dbconfig.ts')}

Using the above config files, you'll notice that the port is not specified (its only specified in the environment variables).  This means when the application attempts to start up, it will fail if the port is not specified via an environment variable:

${d.Execute('Resolved database config', 'doc/dbconfig-run.ts', [], { module: 'boot' })}

What you see, is that the configuration structure must be honored and the application will fail to start if the constraints do not hold true.  This helps to ensure that the configuration, as input to the system, is verified and correct.

By passing in the port via the environment variable, the config will construct properly, and the application will startup correctly:

${d.Execute('Resolved database config', 'doc/dbconfig-run.ts', [], { module: 'boot', env: { DATABASE_PORT: '200' } })}
`;