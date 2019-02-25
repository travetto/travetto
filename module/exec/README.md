travetto: Exec
===

**Install: primary**
```bash
$ npm install @travetto/exec
```

The exec module provides the necessary foundation for calling executables at runtime. Additionally special attention is provided to running [`docker`](https://www.docker.com/community-edition) containers.

## Simple Execution
Just like [`child_process`](https://www.docker.com/community-edition), the module exposes ```spawn```, ```fork```, and ```exec```.  These are generally wrappers around the underlying functionality.  In addition to the base functionality, each of those functions is converted to a ```Promise``` structure, that throws an error on an non-zero return status.

A simple example would be

**Code: Running a directory listing via ls**
```typescript
async function executeListing() {
  const { result } = Exec.spawn('ls');
  await result;
}
```

As you can see, the call returns not only the child process information, but the ```Promise``` to wait for.  Additionally, some common patterns are provided for the default construction of the child process. In addition to the standard options for running child processes, the module also supports:
* `timeout` as the number of milliseconds the process can run before terminating and throwing an error
* `quiet` which suppresses all stdout/stderr output
* `stdin` as a string, buffer or stream to provide input to the program you are running;
* `timeoutKill` allows for registering functionality to execute when a process is force killed by timeout

## Docker Support
Docker provides a unified way of executing external programs with a high level of consistency and simplicity.  For that reason, the framework leverages this functionality to provide a clean cross-platform experience.  The docker functionality allows you to interact with containers in two ways:
* Invoke a single operation against a container
* Spin up a container and run multiple executions against it.  In this format, the container, once started, will be scheduled to terminate on ```Shutdown``` of the application. 

**Code: Establishing mongo as a DockerContainer instance**
```typescript
async function runMongo() {
  const port = 10000;
  const container = new DockerContainer('mongo:latest')
    .createTempVolume('/var/workspace')
    .exposePort(port)
    .setWorkingDir('/var/workspace')
    .forceDestroyOnShutdown();

  container.run(['--storageEngine', 'ephemeralForTest', '--port', port]);
  await container.waitForPorts();

  return;
}
```

## Command Service
While docker containers provide a high level of flexibility, performance can be an issue.  [```CommandService```](./src/command.ts) is a construct that wraps execution of a specific child program.  It allows for the application to decide between using docker to invoke the child program or calling the binary against the host operating system.  This is especially useful in environments where installation of programs (and specific versions) is challenging.

**Code: Command Service example, using pngquant**
```typescript
  const converter = new CommandService({
    containerImage: 'agregad/pngquant',
    localCheck: ['pngquant', ['-h']]
  });

  async function compress(img) {
    const state = await converter.exec('pngquant', '--quality', '40-80', '--speed 1', '--force', '-');
    const out = `${img}.compressed`;

    fs.createReadStream(img).pipe(state.process.stdin);
    state.process.stdout.pipe(fs.createWriteStream(out));
    
    await state.result;
  }
```