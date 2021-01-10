import { doc as d, mod, Config, List, inp, Section, meth, Code, Ordered, Execute, pth, lib, fld } from '@travetto/doc';
import { ConfigManager } from './src/manager';
import { Config as ConfigDec } from './src/decorator';

exports.text = d`

The config module provides support for loading application config on startup. Configuration values support the common ${lib.YAML} constructs as defined in ${mod.Yaml}.  The configuration information is comprised of:

${List(
  d`${lib.YAML} files`,
  d`environment variables`
)}

${Section('Resolution')}

Config loading follows a defined resolution path, below is the order in increasing specificity:
${Ordered(
  d`${pth`resources/application.yml`} - Load the default ${pth`application.yml`} if available.`,
  d`${pth`resources/*.yml`} - Load profile specific configurations as defined by the values in ${fld`process.env.TRV_PROFILES`}`,
  d`${pth`resources/{env}.yml`} - Load environment specific profile configurations as defined by the values of ${fld`process.env.TRV_ENV`}.`,
  d`${fld`process.env`} - Read startup configuration from environment to allow for overriding any values. Because we are overriding a ${lib.YAML} based configuration we need to compensate for the differences in usage patterns.  Generally all environment variables are passed in as ${inp`UPPER_SNAKE_CASE`}. When reading from ${fld`process.env`} we will map ${inp`UPPER_SNAKE_CASE`} to ${inp`upper.snake.case`}, and will attempt to match by case-insensitive name.`
)}

${Section('A Complete Example')}

A more complete example setup would look like:

${Config('resources/application.yml', 'doc/resources/application.yml')}

${Config('resources/prod.yml', 'doc/resources/prod.yml')}

with environment variables

${Config('Environment variables', 'doc/resources/env.properties', 'properties')}

At runtime the resolved config would be:

${Execute('Runtime Resolution', 'doc/resolve.ts')}

${Section('Secrets')}
By default, when in production mode, the application startup will request redacted secrets to log out.  These secrets follow a standard set of rules, but can be amended by listing regular expressions under ${inp`config.redacted`}.

${Section('Consuming')}
The ${ConfigManager.constructor} service provides direct access to all of the loaded configuration. For simplicity, a decorator, ${ConfigDec} allows for classes to automatically be bound with config information on post construction via the ${mod.Di} module. The decorator will install a ${meth`postConstruct`} method if not already defined, that performs the binding of configuration.  This is due to the fact that we cannot rewrite the constructor, and order of operation matters.

The decorator takes in a namespace, of what part of the resolved configuration you want to bind to your class. Given the following class:

${Code('Database config object', 'doc/dbconfig.ts')}

Using the above config files, the resultant object would be:

${Execute('Resolved database config', 'doc/dbconfig-run.ts')}

`;