# Build Lock Design 


## Starting States

None  - Active: No Pid Files, nothing is running

Stale - Active: Pid Files exist, no processes are running

Build - Active: Build Pid File exists
      - Pid File Events: [Create, Touch, Delete]

Watch - Active: Watch Pid File exists
      - Pid File Events: [Create, Touch, Delete on exit/error]


### Scenario 1 None->Build
User triggers a build (cli, or extension)
  -> Build Pid file created, looking good
  -> Start build process
    -> Touch build pid file every second during execution
  -> Remove on complete/error

### Scenario 2 None->Watch
User triggers a watch (cli, or extension)
  -> Watch Pid file created, looking good
  -> Build Pid file created, looking good
  -> Start watch process (repeat on build failure)
    -> Touch file every second during execution
    -> Start build process
      -> Build Pid file created, looking good
        -> Touch build pid file every second during execution
      -> Remove Build Pid File on complete/error (Signals a build completed)
    -> Listen to file changes      
  -> Remove on watch complete/error

### Scenario 3 Stale ->*
Build/Watch file is stale
  -> If process is still active (maybe hung), trigger kill of process if possible
  -> Continue to appropriate state

### Scenario 4 Build->Build'
User triggers a build (cli, or extension) and a build is already running
  -> On stale -> Scenario 3 (and recheck)
  -> On Build Pid File removed -> Return success

### Scenario 5 Build->Watch
User triggers a watch (cli, or extension) and a build is already running
  -> On stale -> Scenario 3 (and recheck)
  -> On Build Pid File Removed -> Scenario 2

### Scenario 6 Watch->Build
User triggers a build (cli, or extension) and a watch is already running
  -> On stale watch pid file -> Scenario 3 (and recheck)
  -> If build pid file is gone, treat as success

### Scenario 7 Watch->Watch'
User triggers a watch (cli, or extension) and a watch is already running
  -> Exit, indicating watch is already running