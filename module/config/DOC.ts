import { d, mod, lib } from '@travetto/doc';
import { Field, Schema } from '@travetto/schema';

import { Config as ConfigDec, EnvVar } from '@travetto/config/src/decorator';
import { Configuration } from '@travetto/config/src/configuration';

export const text = () => d`
${d.Header()}

The config module provides support for loading application config on startup. Configuration values support the common ${lib.YAML} constructs as defined in ${mod.Yaml}.  Additionally, the configuration is built upon the ${mod.Schema} module, to enforce type correctness, and allow for validation of configuration as an 
entrypoint into the application.  Given that all ${ConfigDec} classes are ${Schema}-based classes, all the standard ${Schema} and ${Field} functionality applies.


${d.Section('Resolution')}

The configuration information is comprised of:

${d.List(
  d`configuration files - ${lib.YAML}, ${lib.JSON}, and basic properties file`,
  d`configuration classes`,
)}

Config loading follows a defined resolution path, below is the order in increasing specificity (${d.Field('ext')} can be ${d.Input('yaml')}, ${d.Input('yml')}, ${d.Input('json')}, ${d.Input('properties')}):
${d.Ordered(
  d`${d.Path('resources/application.<ext>')} - Load the default ${d.Path('application.<ext>')} if available.`,
  d`${d.Path('resources/*.<ext>')} - Load profile specific configurations as defined by the values in ${d.Field('process.env.TRV_PROFILES')}`,
  d`${d.Path('resources/{env}.<ext>')} - Load environment specific profile configurations as defined by the values of ${d.Field('process.env.TRV_ENV')}.`,
)}

By default all configuration data is inert, and will only be applied when constructing an instance of a configuration class.

${d.SubSection('A Complete Example')}

A more complete example setup would look like:

${d.Config('resources/application.yml', 'doc/resources/application.yml')}

${d.Config('resources/prod.json', 'doc/resources/prod.json')}

with environment variables

${d.Config('Environment variables', 'doc/resources/env.properties', 'properties')}

At runtime the resolved config would be:

${d.Execute('Runtime Resolution', 'trv', ['main', 'doc/resolve.ts'], {
  profiles: ['doc'],
  env: { TRV_RESOURCES: 'doc/resources', TRV_PROFILES: 'prod' }
})}

${d.SubSection('Custom Configuration Provider')}
In addition to files and environment variables, configuration sources can also be provided via the class itself.  This is useful for reading remote configurations, or dealing with complex configuration normalization.  The only caveat to this pattern, is that the these configuration sources cannot rely on the ${Configuration} service for input.  This means any needed configuration will need to be accessed via specific patterns.

${d.Code('Custom Configuration Source', 'doc/custom-source.ts')}

${d.Section('Startup')}
At startup, the ${Configuration} service will log out all the registered configuration objects.  The configuration state output is useful to determine if everything is configured properly when diagnosing runtime errors.  This service will find all configurations, and output a redacted version with all secrets removed.  The default pattern for secrets is ${d.Input('/password|private|secret/i')}.  More values can be added in your configuration under the path ${d.Field('config.secrets')}.  These values can either be simple strings (for exact match), or ${d.Input('/pattern/')} to create a regular expression.

${d.Section('Consuming')}
The ${Configuration} service provides injectable access to all of the loaded configuration. For simplicity, a decorator, ${ConfigDec} allows for classes to automatically be bound with config information on post construction via the ${mod.Di} module. The decorator will install a ${d.Method('postConstruct')} method if not already defined, that performs the binding of configuration.  This is due to the fact that we cannot rewrite the constructor, and order of operation matters.

${d.SubSection('Environment Variables')}
Additionally there are times in which you may want to also support configuration via environment variables.  ${EnvVar} supports override configuration values when environment variables are present.

The decorator takes in a namespace, of what part of the resolved configuration you want to bind to your class. Given the following class:

${d.Code('Database config object', 'doc/dbconfig.ts')}

You can see that the ${d.Class('DBConfig')} allows for the ${d.Field('port')} to be overridden by the ${d.Input('DATABASE_PORT')} environment variable.

${d.Execute('Resolved database config', 'trv', ['main', 'doc/dbconfig-run.ts'], {
  profiles: ['doc', 'prod'],
  env: { TRV_RESOURCES: 'doc/resources' }
})}

What you see, is that the configuration structure must be honored and the application will fail to start if the constraints do not hold true.  This helps to ensure that the configuration, as input to the system, is verified and correct.

By passing in the port via the environment variable, the config will construct properly, and the application will startup correctly:

${d.Execute('Resolved database config', 'trv', ['main', 'doc/dbconfig-run.ts'], {
  env: { DATABASE_PORT: '200', TRV_RESOURCES: 'doc/resources' },
  profiles: ['doc', 'prod'],
  formatCommand: (cmd, args) => `DATABASE_PORT=200 ${cmd} ${args.join(' ')}`
})}

Additionally you may notice that the ${d.Input('password')} field is missing, as it is redacted by default.
`;