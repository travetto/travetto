/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

import { WorkPool, WorkQueue, ChildCommChannel, ParentCommChannel } from '@travetto/worker';

export const text = <>
  <c.StdHeader />
  This module provides the necessary primitives for handling dependent workers.  A worker can be an individual actor or could be a pool of workers. Node provides ipc (inter-process communication) functionality out of the box. This module builds upon that by providing enhanced event management, richer process management, as well as constructs for orchestrating a conversation between two processes.

  <c.Section title='Execution Pools'>
    With respect to managing multiple executions, {WorkPool} is provided to allow for concurrent operation, and processing of jobs concurrently.  To manage the flow of jobs, {WorkQueue} is provided to support a wide range of use cases. {WorkQueue} allows for manual control of iteration, which is useful for event driven work loads. <br />

    Below is a pool that will convert images on demand, while queuing as needed.

    <c.Code title='Image processing queue, with a fixed batch/pool size' src='doc/images.ts' />

    Once a pool is constructed, it can be shutdown by calling the {d.method('.shutdown()')} method, and awaiting the result.
  </c.Section>

  <c.Section title='IPC Support' >
    Within the {d.input('comm')} package, there is support for two primary communication elements: {ChildCommChannel} and {ParentCommChannel}.  Usually {ParentCommChannel} indicates it is the owner of the sub process. {ChildCommChannel} indicates that it has been created/spawned/forked by the parent and will communicate back to it's parent. This generally means that a {ParentCommChannel} can be destroyed (i.e. killing the subprocess) where a {ChildCommChannel} can only exit the process, but the channel cannot be destroyed.
  </c.Section>
</>;
