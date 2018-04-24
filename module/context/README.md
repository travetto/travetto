travetto: Context
===

Provides a simple wrapper around `cls-hooked` to provide request context across async calls.  

The most common way of utilizing the context, is via the `@WithContext` decorator.
The decorator will load the context on invocation, and will keep the context active during
the entire asynchronous call chain.

For the decorator to work, it require the `class` to have a context object already defined on it.

```typescript
class TestableContext {

   constructor(public context:Context){}

   @WithContext()
   async complexOperator(name: string) {
     this.context.set({ name })
     await this.additionalOp(name);
   }

   async additionalOp(check:string) {
     assert(this.context.get().name === check);
   }
}
```
