# Transformer Refactor

With the introduction of a full type checker, many of the previous limitations are gone and so we should
apply type usage in a consistent fashion, for all scenarios. The primary use case for transformers, is to modify
the behavior of the code in response to type-based information. 

This revolves around determining the shape/structure of a class/interface/parameter/return type, responding appropriately.

The goal for this refactor, will be to provide a simplistic interface into the type structure to make consistent decisions
and to abstract away the underlying type system. Type data can be retrieved via the type checker, or inspecting the AST.  

## Type Structure

```ts
interface Type {
  name?: string; // Name of type, if nominal, otherwise we will generate a unique identifier
  source: string; // Location the type came from
  realType?: Function; // Pointer to real type (String/Date/Number) if applicable
  typeArguments?: Type[]; // Type arguments
  fields?: Record<string, Type>; // Does not include methods, used for shapes not concrete types
  unionTypes?: Type[]; // Array of types 
  comment?: string;
}
```

This structure will allow us to identify all types and build against a consistent API and ultimately this data can be built from 
they typechecker or the AST type information, just with varying degrees of success.