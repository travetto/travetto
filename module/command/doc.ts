import { d, lib } from '@travetto/doc';
import { PathUtil } from '@travetto/boot';
import { DocRunUtil } from '@travetto/doc/src/util/run';

import { CommandService } from './src/command';

export const text = d`
${d.Header()}

The command module provides the necessary foundation for calling complex commands at runtime. Additionally special attention is provided to running ${lib.Docker} containers.

${d.Section('Docker Support')}

Docker provides a unified way of executing external programs with a high level of consistency and simplicity.  For that reason, the framework leverages this functionality to provide a clean cross-platform experience.  The docker functionality allows you to interact with containers in two ways:
${d.List(
  'Invoke a single operation against a container',
  d`Spin up a container and run multiple executions against it.  In this format, the container, once started, will be scheduled to terminate on ${d.Class('Shutdown')} of the application.`
)}

${d.Code('Launching nginx and wait for connect', 'doc/docker.ts')}

${d.Section('Command Service')}

While docker containers provide a high level of flexibility, performance can be an issue.  ${CommandService} is a construct that wraps execution of a specific child program.  It allows for the application to decide between using docker to invoke the child program or calling the binary against the host operating system.  This is especially useful in environments where installation of programs (and specific versions) is challenging.

${d.Code('Command Service example, using pngquant', 'doc/service.ts')}

${d.Section('CLI - command:service')}

The module provides the ability to start/stop/restart services as ${lib.Docker} containers.  This is meant to be used for development purposes, to minimize the effort of getting an application up and running.  Services can be targetted individually or handled as a group.

${d.Execute('Command Service', 'trv', ['command:service', '--help'])}

A sample of all services available to the entire framework:

${d.Terminal('All Services', DocRunUtil.run('trv-service', ['status'], { cwd: PathUtil.resolveUnix(__dirname, '..', '..') }))}

${d.SubSection('Defining new Services')}

The services are defined as plain javascript files within the framework and can easily be extended:

${d.Code('Sample Service Definition', '@travetto/model-elasticsearch/support/service.elasticsearch.ts')}
`;
