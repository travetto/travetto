travetto: Worker
===

**Install: primary**
```bash
$ npm install @travetto/worker
```

This module provides the necessary primitives for handling dependent workers.  A worker can be an individual actor or could be a pool of workers. Node provides ipc functionality out of the box, and this module builds upon this by providing enhanced event management functionality, as well as constructs for orchestrating multi-step processes.  

IPC allows for the program to create the workers, and effectively communicate with it.

## Execution Pools
With respect to managing multiple executions, [`ExecutionPool`](./src/pool.ts) is provided to allow for concurrent operation, and processing of jobs as quickly as possible.

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