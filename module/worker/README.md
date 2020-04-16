travetto: Worker
===

**Install: primary**
```bash
$ npm install @travetto/worker
```

This module provides the necessary primitives for handling dependent workers.  A worker can be an individual actor or could be a pool of workers. Node provides ipc (inter-process communication) functionality out of the box. This module builds upon that by providing enhanced event management, richer process management, as well as constructs for orchestrating a conversation between two processes.  

## Execution Pools
With respect to managing multiple executions, [`WorkPool`](./src/pool.ts) is provided to allow for concurrent operation, and processing of jobs concurrently.  To manage the flow of jobs, there are various [`InputSource`](./src/input/types.ts) implementation that allow for a wide range of use cases.

The supported `InputSource`s are
- ```Queue``` is similar to list but will execute forever waiting for new items to be added to the queue.
- ```Iterable``` supports any iterable (Array, Set, etc) input as well as any async iterable input. The source will continue to produce jobs until the underlying iterator is exhausted.
- ```Event``` is an asynchronous source that allows the caller to determine when the next item is available.  Useful triggering work on event driven problems.

Below is a pool that will convert images on demand, while queuing as needed.

**Code: Image processing queue, with a fixed batch/pool size**
```typescript
class ImageProcessor {
  active = false;
  proc: ChildProcess;

  destroy() {
    this.proc.destroy();
  }

  async execute(path: string) {
    this.active = true;
    try {
      this.proc = ...convert ...
      await this.proc;
    } catch (e) {

    }
    this.active = false;
  }
}

class ImageCompressor extends WorkerPool {

  pendingImages = new QueueInputSource<string>();

  constructor() {
    super(async () => new ImageProcess());
  }

  begin() {
    this.process(this.pendingImages);
  }

  convert(...images: string[]) {
    for (const img of images) {
      this.pendingImages.enqueue(img);
    }
  }
}
```

Once a pool is constructed, it can be shutdown by calling the `.shutdown()` method, and awaiting the result.

## IPC Support

Within the `comm` package, there is support for two primary communication elements: `child` and `parent`.  Usually `parent` indicates it is the owner of the sub process.  `Child` indicates that it has been created/spawned/forked by the parent and will communicate back to it's parent.  This generally means that a `parent` channel can be destroyed (i.e. killing the subprocess) where a `child` channel can only exit the process, but the channel cannot be destroyed.

### IPC as a Worker
A common pattern is to want to model a sub process as a worker, to be a valid candidate in a `WorkPool`.  The `WorkUtil` class provides a utility to facilitate this desire.   

**Code: Spawned Worker Signature**
```typescript
class WorkUtil {
 static spawnedWorker<X>(
    config: SpawnConfig & {
      execute: (channel: ParentCommChannel, input: X) => any,
      destroy?: (channel: ParentCommChannel) => any,
      init?: (channel: ParentCommChannel) => any,
    }
  )
```

When creating your work, via process spawning, you will need to provide the script (and any other features you would like in `SpawnConfig`).   Additionally you must, at a minimum, provide functionality to run whenever an input element is up for grabs in the input source.  This method will be provided the communication channel (`parent`) and the input value.  A simple example could look like:

**Code: Simple Spawned Worker**
```typescript
    const pool = new WorkPool(() =>
      WorkUtil.spawnedWorker<string>({
        command: FsUtil.resolveUnix(__dirname, 'simple.child-launcher.js'),
        fork: true,
        async init(channel) {
          return channel.listenOnce('ready'); // Wait for child to indicate it is ready
        },
        async execute(channel, inp) {
          const res = channel.listenOnce('response'); //  Register response listener
          channel.send('request', { data: inp }); // Send request

          const { data } = await res; // Get answer
          console.log('Sent', inp, 'Received', data);

          assert(inp + inp === data); // Ensure the answer is double the input
        }
      })
    );
```

**Code: Spawned Worker Target**
```typescript
const exec = new ChildCommChannel<{ data: string }>();

exec.listenFor('request', data => {  
  exec.send('response', { data: (data.data + data.data) }); // When data is received, return double
});

exec.send('ready'); // Indicate the child is ready to receive requests

const heartbeat = () => setTimeout(heartbeat, 5000); // Keep-alive
heartbeat();
```