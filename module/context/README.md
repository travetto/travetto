travetto: Context
===

This module provides a wrapper around `nodejs`s [`async_hooks`](https://nodejs.org/api/async_hooks.html) to maintain context across async calls.   This is generally used for retaining contextual user information at various levels of async flow.

The most common way of utilizing the context, is via the `@WithContext` decorator.  The decorator requires the class it's being used in, to have a [`Context`](./src/service/context.ts) member, as it is the source of the contextual information.

The decorator will load the context on invocation, and will keep the context active during the entire asynchronous  call chain.

```typescript
class ContextAwareService {

   constructor(public context:Context){}

   @WithContext()
   async complexOperator(name: string) {
     this.context.set({ name })
     await this.additionalOp(name);

     assert(this.context.get().name === 'finished');
   }

   async additionalOp(check:string) {
     assert(this.context.get().name === check);
     this.context.get().name = `finished`;
   }
}
```

The decorator also allows for a priming of the contextual information.  This is generally useful for system generated operations that are not initiated by a user.

```typescript
class SystemInitiatedContext {

   constructor(public context:Context){}

   @WithContext({
     user: 'system',
     uid: 20
   })
   async runJob(name: string) {
     console.log(`User=${this.context.get().user}, jobName=${name}`);
   }
}
```