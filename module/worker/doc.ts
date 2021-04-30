import { d } from '@travetto/doc';

import { WorkPool } from './src/pool';
import { IterableWorkSet } from './src/input/iterable';
import { ManualAsyncIterator } from './src/input/async-iterator';
import { ChildCommChannel } from './src/comm/child';
import { ParentCommChannel } from './src/comm/parent';
import { WorkUtil } from './src/util';

const WorkSet = d.SnippetLink('WorkSet', 'src/input/types.ts', /interface WorkSet/);

export const text = d`
${d.Header()}

This module provides the necessary primitives for handling dependent workers.  A worker can be an individual actor or could be a pool of workers. Node provides ipc (inter-process communication) functionality out of the box. This module builds upon that by providing enhanced event management, richer process management, as well as constructs for orchestrating a conversation between two processes.

${d.Section('Execution Pools')}
With respect to managing multiple executions, ${WorkPool} is provided to allow for concurrent operation, and processing of jobs concurrently.  To manage the flow of jobs, there are various ${WorkSet} implementation that allow for a wide range of use cases.

The only provided ${WorkSet} is the ${IterableWorkSet} which supports all ${d.Input('Iterable')} and ${d.Input('Iterator')} sources.  Additionally, the module provides ${ManualAsyncIterator} which allows for manual control of iteration, which is useful for event driven work loads.

Below is a pool that will convert images on demand, while queuing as needed.

${d.Code('Image processing queue, with a fixed batch/pool size', 'doc/images.ts')}

Once a pool is constructed, it can be shutdown by calling the ${d.Method('.shutdown()')} method, and awaiting the result.

${d.Section('IPC Support')}

Within the ${d.Input('comm')} package, there is support for two primary communication elements: ${ChildCommChannel} and ${ParentCommChannel}.  Usually ${ParentCommChannel} indicates it is the owner of the sub process.  ${ChildCommChannel} indicates that it has been created/spawned/forked by the parent and will communicate back to it's parent.  This generally means that a ${ParentCommChannel} can be destroyed (i.e. killing the subprocess) where a ${ChildCommChannel} can only exit the process, but the channel cannot be destroyed.

${d.SubSection('IPC as a Worker')}
A common pattern is to want to model a sub process as a worker, to be a valid candidate in a ${WorkPool}.  The ${WorkUtil} class provides a utility to facilitate this desire.

${d.Code('Spawned Worker', 'src/util.ts')}

When creating your work, via process spawning, you will need to provide the script (and any other features you would like in ${d.Input('SpawnConfig')}).   Additionally you must, at a minimum, provide functionality to run whenever an input element is up for grabs in the input source.  This method will be provided the communication channel (${ParentCommChannel}) and the input value.  A simple example could look like:

${d.Code('Spawning Pool', 'doc/spawner.ts')}

${d.Code('Spawned Worker', 'doc/spawned.ts')}

${d.Execute('Output', 'doc/spawner.ts')}
`;
