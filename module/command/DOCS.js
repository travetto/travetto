const { doc: d, Section, List, inp, Code, lib, cls, Execute, Terminal, DocUtil, SubSection } = require('@travetto/doc');
const { CommandService } = require('./src/command');
const { FsUtil } = require('@travetto/boot');

exports.text = d`
The command module provides the necessary foundation for calling complex commands at runtime. Additionally special attention is provided to running ${lib.Docker} containers.

${Section('Docker Support')}

Docker provides a unified way of executing external programs with a high level of consistency and simplicity.  For that reason, the framework leverages this functionality to provide a clean cross-platform experience.  The docker functionality allows you to interact with containers in two ways:
${List(
  'Invoke a single operation against a container',
  d`Spin up a container and run multiple executions against it.  In this format, the container, once started, will be scheduled to terminate on ${cls`Shutdown`} of the application.`
)}

${Code('Launching nginx and wait for connect', 'doc/docker.ts')}

${Section('Command Service')}

While docker containers provide a high level of flexibility, performance can be an issue.  ${CommandService} is a construct that wraps execution of a specific child program.  It allows for the application to decide between using docker to invoke the child program or calling the binary against the host operating system.  This is especially useful in environments where installation of programs (and specific versions) is challenging.

${Code('Command Service example, using pngquant', 'doc/service.ts')}

${Section('CLI - command:service')}

The module provides the ability to start/stop/restart services as ${lib.Docker} containers.  This is meant to be used for development purposes, to minimize the effort of getting an application up and running.  Services can be targetted individually or handled as a group.

${Execute('Command Service', 'travetto', ['command:service', '--help'])}

A sample of all services available to the entire framework:

${Terminal('All Services', DocUtil.run('sh', ['./bin/util/service.js', 'status'], { cwd: FsUtil.resolveUnix(__dirname, '..', '..') }))}

${SubSection('Defining new Services')}

The services are defined as plain javascript files within the framework and can easily be extended:

${Code('Sample Service Definition', '../model-elasticsearch/support/service.elasticsearch.js')}
`;
