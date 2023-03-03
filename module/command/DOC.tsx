/** @jsxImportSource @travetto/doc */
import { RootIndex } from '@travetto/manifest';
import { d, c } from '@travetto/doc';

import { CommandOperation } from '@travetto/command/src/command';

export const text = <>
  <c.StdHeader />
  The command module provides the necessary foundation for calling complex commands at runtime. Additionally special attention is provided to running {d.library('Docker')} containers.

  <c.Section title='Docker Support'>
    Docker provides a unified way of executing external programs with a high level of consistency and simplicity.  For that reason, the framework leverages this functionality to provide a clean cross-platform experience.  The docker functionality allows you to interact with containers in two ways:
    <ul>
      <li>Invoke a single operation against a container</li>
      <li>Spin up a container and run multiple executions against it.  In this format, the container, once started, will be scheduled to terminate on {d.class('Shutdown')} of the application.</li>
    </ul>

    <c.Code title='Launching nginx and wait for connect' src='doc/docker.ts' />
  </c.Section>

  <c.Section title='Command Service'>

    While docker containers provide a high level of flexibility, performance can be an issue.  {CommandOperation} is a construct that wraps execution of a specific child program.  It allows for the application to decide between using docker to invoke the child program or calling the binary against the host operating system.  This is especially useful in environments where installation of programs (and specific versions) is challenging.

    <c.Code title='Command Service example, using pngquant' src='doc/service.ts' />
  </c.Section>

  <c.Section title='CLI - service'>

    The module provides the ability to start/stop/restart services as {d.library('Docker')} containers.  This is meant to be used for development purposes, to minimize the effort of getting an application up and running.  Services can be targeted individually or handled as a group.

    <c.Execution title='Command Service' cmd='trv' args={['service', '--help']} />

    A sample of all services available to the entire framework:

    <c.Execution title='All Services' cmd='trv' args={['service', 'status']} config={{ cwd: RootIndex.manifest.workspacePath }} />

    <c.SubSection title='Defining new Services'>
      The services are defined as plain typescript files within the framework and can easily be extended:

      <c.Code title='Sample Service Definition' src='doc/service.mongo.ts' />
    </c.SubSection>
  </c.Section>
</>;
