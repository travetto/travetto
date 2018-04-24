travetto: Pool
===

A wrapper around `generic-pool` to provide a common framework for pooling resources.

Additionally, it has constructs for handling concurrent executions. This can be used to provide a worker pool
to process batches of work.

For concurrent operations, the following are provided:
- `Array` - Simple linear list of data, will execute until list is exhausted
- `Queue` - Another list like construct, but willk execute forever waiting for new items to be added to the queue
- `Iterator` - A generator function that will continue to produce until the iterator is exhausted