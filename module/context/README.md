<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/context/doc.ts and execute "npx trv doc" to rebuild -->
# Async Context
## Async-aware state management, maintaining context across asynchronous calls.

**Install: @travetto/context**
```bash
npm install @travetto/context
```

This module provides a wrapper around node's [async_hooks](https://nodejs.org/api/async_hooks.html) to maintain context across async calls. This is generally used for retaining contextual user information at various levels of async flow.

The most common way of utilizing the context, is via the [WithAsyncContext](https://github.com/travetto/travetto/tree/main/module/context/src/decorator.ts#L6) decorator.  The decorator requires the class it's being used in, to have a [AsyncContext](https://github.com/travetto/travetto/tree/main/module/context/src/service.ts#L14) member, as it is the source of the contextual information.

The decorator will load the context on invocation, and will keep the context active during the entire asynchronous call chain.

**Code: Usage of context within a service**
```typescript
import { AsyncContext, WithAsyncContext } from '@travetto/context';

export class ContextAwareService {

  constructor(public context: AsyncContext) { }

  @WithAsyncContext()
  async complexOperator(name: string) {
    this.context.set({ name });
    await this.additionalOp('extra');
    await this.finalOp();
  }

  async additionalOp(additional: string) {
    const { name } = this.context.get();
    this.context.set({ name: `${name} ${additional}` });
  }

  async finalOp() {
    const { name } = this.context.get();
    // Use name
    return name;
  }
}
```

The decorator also allows for a priming of the contextual information.  This is generally useful for system generated operations that are not initiated by a user.

**Code: Usage of context within a service**
```typescript
import { AsyncContext, WithAsyncContext } from '@travetto/context';

export class SystemInitiatedContext {

  constructor(public context: AsyncContext) { }

  @WithAsyncContext({
    user: 'system',
    uid: 20
  })
  async runJob(name: string) {
    console.log('Running', { user: this.context.get().user, jobName: name });
  }
}
```

## Extension - Rest

Within the [RESTful API](https://github.com/travetto/travetto/tree/main/module/rest#readme "Declarative api for RESTful APIs with support for the dependency injection module.") module, it can be challening to share context across the various layers that may be touched by a request.  This module provides [AsyncContextInterceptor](https://github.com/travetto/travetto/tree/main/module/context/src/extension/rest.interceptor.ts#L17) to create a data store that will be private to an individual request. This is used by [Rest Auth](https://github.com/travetto/travetto/tree/main/module/auth-rest#readme "Rest authentication integration support for the travetto framework") to store authentiated user information for built-in authorization and permission validation.
