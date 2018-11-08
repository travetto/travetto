travetto: Schedule 
===

**Install: primary**
```bash
$ npm install @travetto/schedule
```


This module provides the ability to execute functionality at specific intervals within the application. Under the covers, the module wraps [`cron`](https://github.com/kelektiv/node-cron). The scheduling api provides high level constructs for simple intervals, and , and job termination.  Also manages all outstanding jobs, and will terminate all jobs on shutdown. 

Additionally, supports the full cron syntax for any specific scheduling needed.

**Code: Scheduling an operation every minute**
```typescript
@Injectable()
class Scheduling {

  async heartbeat() {
    Scheduler.perMinute(() => {
      ... request against server ...
      if (!alive) {
        ... handle status ...
      }
    });
  }
}
```

