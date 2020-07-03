# Command
## Support for executing complex commands at runtime.

**Install: @travetto/command**
```bash
npm install @travetto/command
```

The command module provides the necessary foundation for calling complex commands at runtime. Additionally special attention is provided to running [docker](https://www.docker.com/community-edition) containers.

## Docker Support

Docker provides a unified way of executing external programs with a high level of consistency and simplicity.  For that reason, the framework leverages this functionality to provide a clean cross-platform experience.  The docker functionality allows you to interact with containers in two ways:
   
   *  Invoke a single operation against a container
   *  Spin up a container and run multiple executions against it.  In this format, the container, once started, will be scheduled to terminate on `Shutdown` of the application.

**Code: Launching nginx and wait for connect**
```typescript
import { DockerContainer } from '@travetto/command/src/docker';
import { CommandUtil } from '@travetto/command/src/util';

export class NginxServer {
  container: DockerContainer;

  constructor(
    private port = Math.trunc(Math.random() * 40000) + 10000
  ) {
    this.container = new DockerContainer('nginx:latest')
      .exposePort(this.port, 80)
      .forceDestroyOnShutdown();
  }
  start() {
    this.container.run();
    CommandUtil.waitForPort(this.port);
    console.log('Ready!');
  }

  async stop() {
    await this.container.stop();
    console.log('Stopped');
  }
}
```

## Command Service

While docker containers provide a high level of flexibility, performance can be an issue.  [CommandService](https://github.com/travetto/travetto/tree/1.0.0-dev/module/command/src/command.ts#L11) is a construct that wraps execution of a specific child program.  It allows for the application to decide between using docker to invoke the child program or calling the binary against the host operating system.  This is especially useful in environments where installation of programs (and specific versions) is challenging.

**Code: Command Service example, using pngquant**
```typescript
import * as fs from 'fs';
import { CommandService } from '@travetto/command/src/command';

export class ImageCompressor {
  converter = new CommandService({
    containerImage: 'agregad/pngquant',
    localCheck: ['pngquant', ['-h']]
  });

  async compress(img: string) {
    const state = await this.converter.exec('pngquant', '--quality', '40-80', '--speed 1', '--force', '-');
    const out = `${img}.compressed`;

    // Feed into process
    fs.createReadStream(img).pipe(state.process.stdin!);
    // Feed from process to file system
    state.process.stdout!.pipe(fs.createWriteStream(out));

    await state.result;
  }
}
```

## CLI - command:service

The module provides the ability to start/stop/restart services as [docker](https://www.docker.com/community-edition) containers.  This is meant to be used for development purposes, to minimize the effort of getting an application up and running.  Services can be targetted individually or handled as a group.

**Terminal: Command Service**
```bash
$ travetto travetto command:service --help

Usage:  command:service [options] [start|stop|restart|status] [...services]

Options:
  -h, --help  display help for command
```

A sample of all services available to the entire framework:

**Terminal: All Services**
```bash
Service          Version    Status
----------------------------------------------

 * redis                  5    Not running
 * elasticsearch      6.8.2    Not running
 * mongodb              3.6    Not running
 * mysql                5.6    Not running
 * postgresql          12.2    Not running
```

### Defining new Services

The services are defined as [JSON](https://www.json.org) files within the framework and can easily be extended:

**Code: Sample Service Definition**
```json
{
  "name": "elasticsearch",
  "version": "6.8.2",
  "port": 9200,
  "env": {
    "discovery.type": "single-node"
  },
  "image": "docker.elastic.co/elasticsearch/elasticsearch:6.8.2"
}
```

