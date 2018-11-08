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
  const [process, resultPromise] = spawn('ls');
  await resultPromise;
}
```

As you can see, the call returns not only the child process information, but the ```Promise``` to wait for.  Additionally, some common patterns are provided for the default construction of the child process. In addition to the standard options for running child processes, the module also supports:
* `timeout` as the number of milliseconds the process can run before terminating and throwing an error
* `quiet` which suppresses all stdout/stderr output
* `stdin` as a string, buffer or stream to provide input to the program you are running;
* `timeoutKill` allows for registering functionality to execute when a process is force killed by timeout

## Inter-process Communication (IPC)
Node provides ipc functionality out of the box, and this module builds upon this by providing enhanced event management functionality, as well as constructs for orchestrating multi-step processes.

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

  container.run('--storageEngine', 'ephemeralForTest', '--port', port);
  await DockerContainer.waitForPort(port);

  return;
}
```

## Command Service
While docker containers provide a high level of flexibility, performance can be an issue.  [```CommandService```](./src/command.ts) is a construct that wraps execution of a specific child program.  It allows for the application to decide between using docker to invoke the child program or calling the binary against the host operating system.  This is especially useful in environments where installation of programs (and specific versions) is challenging.

**Code: Command Service example, using pngquant**
```typescript
  const converter = new CommandService({
    image: 'agregad/pngquant',
    checkForLocal: async () => {
      return (await spawn('pngquant -h')[1]).valid;
    }
  });

  async function compress(img) {
    const [proc, prom] = await converter.exec('pngquant', '--quality', '40-80', '--speed 1', '--force', '-');
    const out = `${img}.compressed`;

    fs.createReadStream(img).pipe(proc.stdin);
    proc.stdout.pipe(fs.createWriteStream(out));
    
    await prom;
  }
```

## Execution Pools
With respect to managing multiple executions, [`ExecutionPool`](./src/pool/pool.ts) is provided to allow for concurrent operation, and processing of jobs as quickly as possible.

To manage the flow of jobs, there are various [`DataExecutionSource`](./src/pool/types.ts) implementation that allow for a wide range of use cases.

The supported `DataExecutionSource`s are
* ```Array``` is a list of jobs, will execute in order until list is exhausted. 
- ```Queue``` is similar to list but will execute forever waiting for new items to be added to the queue.
- ```Iterator``` is a generator function that will continue to produce jobs until the iterator is exhausted.

Below is a pool that will convert images on demand, while queuing as needed.

**Code: Image processing queue, with a fixed batch/pool size**
```typescript
class ImageProcessor {
  active = false;
  proc: ChildProcess;

  kill() {
    this.proc.kill();
  }

  async convert(path: string) {
    this.active = true;
    try {
      this.proc = ...convert ...
      await this.proc;
    } catch (e) {

    }
    this.active = false;
  }
}

class ImageCompressor {
  pendingImages: QueueExecutionSource<string>;

  pool = new ExecutionPool(async () => {
    return new ImageProcessor();
  });

  constructor() {
    this.pool.process(this.pendingImages, async (inp, exe) => {
      exe.convert(inp);
    });
  }

  convert(...images: string[]) {
    for (const img of images) {
      this.pendingImages.enqueue(img);
    }
  }
}
```