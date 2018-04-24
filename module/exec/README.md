travetto: Exec
===

This module provides general operations for working with processes

 - Allows for running a single command
 - Allows for running commands through a pool of workers
 - Defaults to `cross-spawn` where possible.
 - Provides constructs for managing IPC (inter-process communication)
 - Allows for running docker operations with proper handling of execution
  - Will catch when the docker container has run away, and will terminate within timeouts