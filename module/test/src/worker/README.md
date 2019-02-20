Flow of events
-----------------

1. manager
  - spawns worker

2. worker
  - calls 'ready' event

3. manager
  - listens for ready
  - triggers init

4. worker
  - listens for init
  - initializes workspace for testing
  - triggers initComplete

5. manager
  - listens for initComplete
  - triggers run with a specific file to run

6. worker
  - listens for run
  - Executes tests in specified file
    - Communicates results back over process messaging
  - triggers runComplete

7. manager
  - Marks tests as done
