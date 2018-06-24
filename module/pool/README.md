travetto: Pool
===
This module provides an API for dealing with pools of elements, and special attention is given to pools that are used for managing jobs as opposed to simple resources.

The module wraps around [`generic-pool`](https://github.com/coopernurse/node-pool) as a base for the pooling mechanism.

With respect to managing jobs, [`ConcurrentPool`](./src/concurrent/concurrent.ts) is provided to allow for concurrent operation, and processing of jobs as quickly as possible.

To manage the flow of jobs, there are various [`DataSource`](./src/concurrent/types.ts) implementation that allow for a wide range of use cases.

The supported `DataSource`s are
* ```Array``` is a list of jobs, will execute in order until list is exhausted. 
- ```Queue``` is similar to list but will execute forever waiting for new items to be added to the queue.
- ```Iterator``` is a generator function that will continue to produce jobs until the iterator is exhausted.

Below is a pool that will convert images on demand, while queuing as needed.

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
  pendingImages: QueueDataSource<string>;

  pool = new ConcurrentPool(async () => {
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