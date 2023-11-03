# Shutdown Behavior

What does it mean to "shutdown"?  A process can exit due to the following reasons:

1. The process successfully completes
  - Trigger #3
2. Unhandled errors, rejections
  - If unexpected
    - Trigger #3
  - If expected (Used during testing, and module loading)
    - Handle, continue
3. External signal to ensure a stop (SIGINT)
  - Run through all shutdown handlers
  - Have a hard timeout that will fire after N seconds to force exit
4. External signal to request a stop (SIGUSR2)
  - Run through all shutdown handlers
  - No forced exit
5. Immediate Termination (SIGKILL, SIGTERM)
  - Nothing to do, process is over