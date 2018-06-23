travetto: Exec
===

The exec module provides the necessary foundation for calling executables at runtime. Additionally special attention is provided to 
running [`docker`](https://www.docker.com/community-edition) containers.

## Simple Execution
Just like [`child_process`](https://www.docker.com/community-edition), the module exposes ```spawn```, ```fork```, and ```exec```.  These are generally wrappers around the underlying functionality.  In addition to the base functionality, each of those functions is converted to a ```Promise``` structure, that throws an error on an non-zero return status.

A simple example would be
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


This module provides general operations for working with processes

 - Allows for running a single command
 - Provides constructs for managing IPC (inter-process communication)
 - Allows for running docker operations with proper handling of execution
  - Will catch when the docker container has run away, and will terminate within timeouts