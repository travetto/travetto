# Transformer Refactor

With the introduction of a full type checker, many of the previous limitations are gone and so we should
apply type usage in a consistent fashion, for all scenarios.

## Return Types
We will infer the return type of a method, while optionally unwrapping it from the promise if such.  

## Method parameters
Will infer from the typing information.

## Properties
Will infer from the typing information.

## Interfaces vs Classes vs built-ins

When dealing with types, Classes provide concrete references to desired values.  Unless passed as a parameter, an interface should be usable in any 
situation where only a type is required.  The transformer will convert the interface to a concrete reference designated by the declaration file.  

Interfaces will need some form of indicator for registration?.  Either by implementing an interface or comments of sorts.
