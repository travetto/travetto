/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { Field, Schema } from '@travetto/schema';

import { Config as ConfigDec, EnvVar } from '@travetto/config/src/decorator';
import { Configuration } from '@travetto/config/src/configuration';

export const text = <>
  <c.StdHeader />

  The config module provides support for loading application config on startup. Configuration values support the common {d.library('YAML')} constructs as defined in {d.mod('Yaml')}.  Additionally, the configuration is built upon the {d.mod('Schema')} module, to enforce type correctness, and allow for validation of configuration as an entrypoint into the application.  Given that all {ConfigDec} classes are {Schema}-based classes, all the standard {Schema} and {Field} functionality applies.

  <c.Section title='Resolution'>

    The configuration information is comprised of:

    <ul>
      <li>configuration files - {d.library('YAML')}, {d.library('JSON')}, and basic properties file</li>
      <li>configuration classes</li>
    </ul>

    Config loading follows a defined resolution path, below is the order in increasing specificity ({d.field('ext')} can be {d.input('yaml')}, {d.input('yml')}, {d.input('json')}, {d.input('properties')}):
    <ol>
      <li>{d.path('resources/application.<ext>')} - Load the default {d.path('application.<ext>')} if available.</li>
      <li>{d.path('resources/*.<ext>')} - Load profile specific configurations as defined by the values in {d.field('process.env.TRV_PROFILES')}</li>
      <li>{d.path('resources/{env}.<ext>')} - Load environment specific profile configurations as defined by the values of {d.field('process.env.TRV_ENV')}.</li>
    </ol>

    By default all configuration data is inert, and will only be applied when constructing an instance of a configuration class.

    <c.SubSection title='A Complete Example'>

      A more complete example setup would look like:

      <c.Config title='resources/application.yml' src='doc/resources/application.yml' />

      <c.Config title='resources/prod.json' src='doc/resources/prod.json' />

      with environment variables

      <c.Config title='Environment variables' src='doc/resources/env.properties' language='properties' />

      At runtime the resolved config would be:

      <c.Execution title='Runtime Resolution' cmd='trv' args={['main', 'doc/resolve.ts']} config={{
        profiles: ['doc'],
        env: { TRV_RESOURCES: 'doc/resources', TRV_PROFILES: 'prod' }
      }} />
    </c.SubSection>

    <c.SubSection title='Standard Configuration Extension'>
      The framework provides two simple base classes that assist with existing patterns of usage to make adding in new configuration sources as easy as possible.  The goal here is for the developer to either instantiate or extend these classes and produce a configuration source unique to their needs:

      <c.Code title='Memory Provider' src='src/source/memory.ts'></c.Code>

      <c.Code title='Environment JSON Provider' src='src/source/env.ts'></c.Code>

    </c.SubSection>

    <c.SubSection title='Custom Configuration Provider'>
      In addition to files and environment variables, configuration sources can also be provided via the class itself.  This is useful for reading remote configurations, or dealing with complex configuration normalization.  The only caveat to this pattern, is that the these configuration sources cannot rely on the {Configuration} service for input.  This means any needed configuration will need to be accessed via specific patterns.

      <c.Code title='Custom Configuration Source' src='doc/custom-source.ts' />
    </c.SubSection>
  </c.Section>

  <c.Section title='Startup'>
    At startup, the {Configuration} service will log out all the registered configuration objects.  The configuration state output is useful to determine if everything is configured properly when diagnosing runtime errors.  This service will find all configurations, and output a redacted version with all secrets removed.  The default pattern for secrets is {d.input('/password|private|secret/i')}.  More values can be added in your configuration under the path {d.field('config.secrets')}.  These values can either be simple strings (for exact match), or {d.input('/pattern/')} to create a regular expression.
  </c.Section>
  <c.Section title='Consuming'>
    The {Configuration} service provides injectable access to all of the loaded configuration. For simplicity, a decorator, {ConfigDec} allows for classes to automatically be bound with config information on post construction via the {d.mod('Di')} module. The decorator will install a {d.method('postConstruct')} method if not already defined, that performs the binding of configuration.  This is due to the fact that we cannot rewrite the constructor, and order of operation matters.

    <c.SubSection title='Environment Variables'>
      Additionally there are times in which you may want to also support configuration via environment variables.  {EnvVar} supports override configuration values when environment variables are present. <br />

      The decorator takes in a namespace, of what part of the resolved configuration you want to bind to your class. Given the following class:

      <c.Code title='Database config object' src='doc/dbconfig.ts' />

      You can see that the {d.class('DBConfig')} allows for the {d.field('port')} to be overridden by the {d.input('DATABASE_PORT')} environment variable.

      <c.Execution title='Resolved database config' cmd='trv' args={['main', 'doc/dbconfig-run.ts']} config={{
        profiles: ['doc', 'prod'],
        env: { TRV_RESOURCES: 'doc/resources' }
      }} />

      What you see, is that the configuration structure must be honored and the application will fail to start if the constraints do not hold true.  This helps to ensure that the configuration, as input to the system, is verified and correct. <br />

      By passing in the port via the environment variable, the config will construct properly, and the application will startup correctly:

      <c.Execution title='Resolved database config' cmd='trv' args={['main', 'doc/dbconfig-run.ts']} config={{
        env: { DATABASE_PORT: '200', TRV_RESOURCES: 'doc/resources' },
        profiles: ['doc', 'prod'],
        formatCommand: (cmd, args) => `DATABASE_PORT=200 ${cmd} ${args.join(' ')}`
      }} />

      Additionally you may notice that the {d.input('password')} field is missing, as it is redacted by default.
    </c.SubSection>
  </c.Section>
</>;