/** @jsxImportSource @travetto/doc/support */
import { c } from '@travetto/doc';
import { AsyncQueue } from '@travetto/runtime';
import { WorkPool, IpcChannel } from '@travetto/worker';

export const text = <>
  <c.StdHeader />
  This module provides the necessary primitives for handling dependent workers.  A worker can be an individual actor or could be a pool of workers. Node provides ipc (inter-process communication) functionality out of the box. This module builds upon that by providing enhanced event management, richer process management, as well as constructs for orchestrating a conversation between two processes.

  <c.Section title='Execution Pools'>
    With respect to managing multiple executions, {WorkPool} is provided to allow for concurrent operation, and processing of jobs concurrently.  To manage the flow of jobs, {AsyncQueue} is used to support a wide range of use cases. {AsyncQueue} allows for manual control of iteration, which is useful for event driven work loads. <br />
  </c.Section>

  <c.Section title='IPC Support' >
    To handle communication between processes, {IpcChannel} is provided. This class abstracts the underlying IPC mechanism and provides a simple interface for sending and receiving messages. It also includes event management capabilities, allowing for easy handling of different message types. By default the class assumes it is running in a child process, but it can also be used in a parent process (by passing in the child process) to communicate with child processes.
  </c.Section>
</>;
