import { d, Section, List, Library, inp, Code } from '@travetto/doc';
import { CommandService } from './src/command';

export default d`
The command module provides the necessary foundation for calling complex commands at runtime. Additionally special attention is provided to running ${Library('docker', 'https://www.docker.com/community-edition')} containers.

${Section('Docker Support')}

Docker provides a unified way of executing external programs with a high level of consistency and simplicity.  For that reason, the framework leverages this functionality to provide a clean cross-platform experience.  The docker functionality allows you to interact with containers in two ways:
${List(
  'Invoke a single operation against a container',
  d`Spin up a container and run multiple executions against it.  In this format, the container, once started, will be scheduled to terminate on ${inp`Shutdown`} of the application.`
)}

${Code('Launching nginx and wait for connect', 'alt/docs/src/docker.ts')}

${Section('Command Service')}

While docker containers provide a high level of flexibility, performance can be an issue.  ${CommandService} is a construct that wraps execution of a specific child program.  It allows for the application to decide between using docker to invoke the child program or calling the binary against the host operating system.  This is especially useful in environments where installation of programs (and specific versions) is challenging.

${Code('Command Service example, using pngquant', 'alt/docs/src/service.ts')}
`;
