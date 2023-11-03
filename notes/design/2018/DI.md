# Dependency Injection

The goal of the dependency injector is to abstract away instance usage from creation.  To rely upon contracts vs implementations.  This level of indirection provides flexibility in the development (and testing) process.  With the ability to rely on these abstractions, some additional goals/desires crop up.

## Basics

For the most basic scenario, let's say you have a class:

```typescript
class A {
  field1: string;
}
```

If I want an instance of `A`, I would asking the injector for an instance of `A` and the injector would call `new A()` and everything would just work.

Where things get interesting, are in handling transitive dependencies.  Given this new class:
```typescript
class B {
  @Inject() a: A;

  field1: string;

  constructor(z: Z) {
    ...
  }
}
```

I now have two areas to inject values into: fields and constructor params.  The goal of the injector is to now resolve all those dependencies before returning an instance.  To receive an instance of `B`, the injector would need to create an `A` and a `Z`, construct `B` (with `Z` as a param) and set the field `a` post construction.

```typescript
const z = new Z();
const b = new B(z);
const a = new A();
b.a = a;
```

So, at a high level, this is the majority of the work for a DI system.  Natural growth of expectations would lead to:
1. Reference sub types, by the parent class
1. Being able to have multiple versions of the same class, with different configuration.
1. Use to produce customizations of values without the need for inheritance
1. Being able to store arbitrary values.

## Sub Typing
Sub typing, for all of it's warts, is a simple way of establishing and honoring a contract.  Specifically, sub typing an abstract class provides a clean mechanism for indicating intent, and allow for multiple implementations of that standard.

In the DI system, when a dependency is registered, it should take it's parentage into consideration.  One for being able to identify a child via it's parent, and two to provide inheritance of dependent fields (not constructor params).

This nature allows for the following scenario:
```typescript
abstract class B {
  @Inject() a: A;

  field1: string;

  constructor(z: Z) {
    ...
  }

  abstract get something(): string;
}

class C extends B {
  something = 'special';
  
  constructor(z: Z) {
    super(z);
  }
}

```

At this point I should be able to ask for an instance of `B`, and `C` should be the default implementation, and be provided.

## Multiple instances of the Same Type
So this leads to a natural point, in which I may have multiple versions of `B`, and which one do I choose? Generally, there will only be one implementation of an abstract class in play at a time, but there are scenarios in which this may not hold true.

So there is an additional need here to differentiate implementations by some identifier. This identifier will be known as a qualifier.

```typescript
abstract class B {
  @Inject() a: A;
  abstract get something(): string;
}

@Injectable('custom-c')
class C extends B {
  something = 'special';
}

@Injectable('custom-d')
class D extends B {
  something = 'special-er';
}
```

By default, the qualifier points to the default qualifier, which facilitates the single implementation state.  Usually you will have a single implementation as the default, and need to qualify injections out side of that scope.  By default, if not specified, the first class found will be the default implementation.

## Value Customizations
As wonderful as inheritance can be, the need to extend for every variation can be overwhelming.  To that end, the ability to dynamically create configs at runtime provides much more flexibility than inheritance.

```typescript
abstract class B {
  @Inject() a: A;
  abstract get something(): string;
}

// Inheritance
@Injectable('custom-c')
class C extends B {
  something = 'special';
}

// Factory method
class Config {
  @InjectableFactory()
  static buildIt(): B {
    const b = new B();
    b.something = 'special-er';
    return b;
  }
}
```

In the example, the static method defines itself as a factory with `B` as the target return type.  As you notice as well, `b.a` is never set, as the injector will fill those out post construction.  This factory method takes the place of the constructor portion of the DI process, nothing else.

## Arbitrary Values
While this is a feature of many injectors, the goal here is to rely upon the class system as a way of providing real constructs that are immutable.  To that end, String is a real class, so a factory function could look like:

```typescript
// Factory method
const SECRET = symbol('secret');
class Config {
  @InjectableFactory({qualifier: SECRET, target: String })
  static buildConst() {
    return 'value';
  }
}

const B {
  @Inject({ qualifier: SECRET, target: String }) value: string;
}
```

Normally in typescript you wouldn't use `String` directly so we specify the target of the injection directly.  Since all primitives are objects, this will hold true for all possible values.

## Identifying
Some common nomenclature in defining dependencies will be:

`Alias` another reference point to a `Class`
`Target` the contract a dependency aims to provide.
`Class` a specific data type
`Function` can be used to produce values 
`Qualifier` a differentiation of 
`Instance` a specific instance of a `Class`

The entire goal here is to convert `Target`, and `Qualifier` into specific `Instance`s that can be used at run time.

`Instances` will either be produced by `Class` construction or `Function` invocation.

Sub-classes will be `Alias`ed as their own `Class` as well as their parent `Class`, which should be the general `Target`, with a generated `Qualifier`.

During live reload, unloading will happen at a `Class` level, and not at the `Target` level.  You generally cannot change the contract and have the code work. Though you can change the implementation and have it respond accordingly.

