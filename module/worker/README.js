const { doc: d, Section, SnippetLink, inp, Code, meth, SubSection, Execute } = require('@travetto/doc');
const { WorkPool } = require('./src/pool');
const { IterableInputSource } = require('./src/input/iterable');
const { DynamicAsyncIterator } = require('./src/input/async-iterator');
const { ChildCommChannel } = require('./src/comm/child');
const { ParentCommChannel } = require('./src/comm/parent');
const { WorkUtil } = require('./src/util');

const InputSource = SnippetLink('InputSource', 'src/input/types.ts', /interface InputSource/);

exports.text = d`
This module provides the necessary primitives for handling dependent workers.  A worker can be an individual actor or could be a pool of workers. Node provides ipc (inter-process communication) functionality out of the box. This module builds upon that by providing enhanced event management, richer process management, as well as constructs for orchestrating a conversation between two processes.

${Section('Execution Pools')}
With respect to managing multiple executions, ${WorkPool} is provided to allow for concurrent operation, and processing of jobs concurrently.  To manage the flow of jobs, there are various ${InputSource} implementation that allow for a wide range of use cases.

The only provided ${InputSource} is the ${IterableInputSource} which supports all ${inp`Iterable`} and ${inp`Iterator`} sources.  Additionally, the module provides ${DynamicAsyncIterator} which allows for manual control of iteration, which is useful for event driven work loads.

Below is a pool that will convert images on demand, while queuing as needed.

${Code('Image processing queue, with a fixed batch/pool size', 'alt/docs/src/images.ts')}

Once a pool is constructed, it can be shutdown by calling the ${meth`.shutdown()`} method, and awaiting the result.

${Section('IPC Support')}

Within the ${inp`comm`} package, there is support for two primary communication elements: ${ChildCommChannel} and ${ParentCommChannel}.  Usually ${ParentCommChannel} indicates it is the owner of the sub process.  ${ChildCommChannel} indicates that it has been created/spawned/forked by the parent and will communicate back to it's parent.  This generally means that a ${ParentCommChannel} can be destroyed (i.e. killing the subprocess) where a ${ChildCommChannel} can only exit the process, but the channel cannot be destroyed.

${SubSection('IPC as a Worker')}
A common pattern is to want to model a sub process as a worker, to be a valid candidate in a ${WorkPool}.  The ${WorkUtil} class provides a utility to facilitate this desire.

${Code('Spawned Worker', 'src/util.ts')}

When creating your work, via process spawning, you will need to provide the script (and any other features you would like in ${inp`SpawnConfig`}).   Additionally you must, at a minimum, provide functionality to run whenever an input element is up for grabs in the input source.  This method will be provided the communication channel (${ParentCommChannel}) and the input value.  A simple example could look like:

${Code('Spawning Pool', 'alt/docs/src/spawner.ts')}

${Code('Spawned Worker', './alt/docs/src/spawned.js')}

${Execute('Output', './alt/docs/src/spawner.ts')}
`;
