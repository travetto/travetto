travetto: Worker
===

**Install: primary**
```bash
$ npm install @travetto/worker
```

This module provides the necessary primitives for handling dependent workers.  A worker can be an individual actor or could be a pool of workers. Node provides ipc (inter-process communication) functionality out of the box. This module builds upon that by providing enhanced event management, richer process management, as well as constructs for orchestrating a conversation between two processes.  

## Execution Pools
With respect to managing multiple executions, [`WorkerPool`](./src/pool.ts) is provided to allow for concurrent operation, and processing of jobs concurrently.  To manage the flow of jobs, there are various [`WorkerInputSource`](./src/types.ts) implementation that allow for a wide range of use cases.

The supported `WorkerInputSource`s are
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

  pendingImages: WorkerQueueInputSource<string>;

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