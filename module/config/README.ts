import { d, Library, Mod, Config, List, inp, Section, Terminal, meth, Code, Ordered, Execute, pth } from '@travetto/doc';
import { ConfigManager } from './src/manager';
import { Config as ConfigDec } from './src/decorator';

const YAML = Library('yaml', 'https://en.wikipedia.org/wiki/YAML');

export default d`

The config module provides support for loading application config on startup. Configuration values support the common ${YAML} constructs as defined in ${Mod('yaml')}.  The configuration information is comprised of:

${List(
  d`${inp`yaml`} files`,
  d`environment variables`
)}

${Section('Resolution')}

Config loading follows a defined resolution path, below is the order in increasing specificity:
${Ordered(
  d`${pth`resources/application.yml`} - Load the default ${pth`application.yml`} if available.`,
  d`${pth`resources/*.yml`} - Load profile specific configurations as defined by the values in ${inp`process.env.TRV_PROFILES`}`,
  d`${pth`resources/{env}.yml`} - Load environment specific profile configurations as defined by the values of ${inp`process.env.TRV_ENV`}.`,
  d`${inp`process.env`} - Read startup configuration from environment to allow for overriding any values. Because we are overriding a ${YAML} based configuration we need to compensate for the differences in usage patterns.  Generally all environment variables are passed in as ${inp`UPPER_SNAKE_CASE`}. When reading from ${inp`process.env`} we will map ${inp`UPPER_SNAKE_CASE`} to ${inp`upper.snake.case`}, and will attempt to match by case-insensitive name.`
)}

${Section('A Complete Example')}

A more complete example setup would look like:

${Config('resources/database.yml', 'alt/docs/resources/database.yml')}

${Config('resources/prod.yml', 'alt/docs/resources/prod.yml')}

with environment variables

${Config('Environment variables', 'alt/docs/resources/env.properties', 'properties')}

At runtime the resolved config would be:

${Execute('Runtime Resolution', 'alt/docs/src/resolve.ts')}


${Section('Secrets')}
By default, when in production mode, the application startup will request redacted secrets to log out.  These secrets follow a standard set of rules, but can be amended by listing regular expressions under ${inp`config.redacted`}.

${Section('Consuming')}
The ${ConfigManager} service provides direct access to all of the loaded configuration. For simplicity, a decorator, ${ConfigDec} allows for classes to automatically be bound with config information on post construction via the ${Mod('di')} module. The decorator will install a ${meth`postConstruct`} method if not already defined, that performs the binding of configuration.  This is due to the fact that we cannot rewrite the constructor, and order of operation matters.

The decorator takes in a namespace, of what part of the resolved configuration you want to bind to your class. Given the following class:

${Code('Database config object', 'alt/docs/src/dbconfig.ts')}

Using the above config files, the resultant object would be:

${Execute('Resolved database config', 'alt/docs/src/dbconfig-run.ts')}

`;