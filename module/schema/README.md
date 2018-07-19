travetto: Schema
===

This module provide a mechanisms for registering classes and field level information as well the ability to apply that information at runtime.

## Registration
The registry's schema information is defined by `typescript` AST and only applies to classes registered as `@Schema`s. The module utilizes AST transformations to collect schema information, and facilitate the registration process without user intervention.

```typescript
@Schema()
class User {
  name: string;
  age: number;
  favoriteFood?: 'pizza'|'burrito'|'salad';
}
```
From this schema, the registry would have the following information:

```yaml
User:
  fields:
    - 
      name: name
      type": string
      required: true 
    -
      name: age
      type: number
      required: true      
    -
      name: favoriteFood
      type: string
      required: false
      allowedValues: ["pizza", "burrito", "salad" ]
```

This provides a powerful base for data binding and validation at runtime.  Additionally there may be types that cannot be detected, or some information that the programmer would like to override. Below are the supported field decorators:

 * `@Field` defines a field that will be serialized, generally used in conjunction with ```@Schema(false)``` which disables the auto registration.
 * `@Require` defines a that field should be required
 * `@Enum` defines the allowable values that a field can have
 * `@Trimmed` augments binding to remove leading and trailing whitespace from string values
 * `@Match` defines a regular expression that the field value should match
 * `@MinLength` enforces min length of a string
 * `@MaxLength` enforces max length of a string
 * `@Min` enforces min value for a date or a number
 * `@Max` enforces max value for a date or a number
 * `@Email` ensures string field matches basic email regex
 * `@Telephone` ensures string field matches basic telephone regex
 * `@Url` ensures string field matches basic url regex
 * `@Ignore` exclude from auto schema registration
 * `@Integer` ensures number passed in is only a whole number
 * `@Float` ensures number passed in allows fractional values

Additionally, schemas can be nested to form more complex data structures that are able to bound and validated.

## Binding/Validation
At runtime, once a schema is registered, a programmer can utilize this structure to perform specific operations. Specifically binding and validation. 

### Binding
Binding is a very simple operation, as it takes in a class registered as as `@Schema` and a JS object that will be the source of the binding. Given the schema

```typescript
@Schema()
class Address {
  street1: string;
  street2: string;
}

@Schema()
class Person {
  name: string;
  @Integer() age: number;
  address: Address;
}
```

A binding operation could look like

```typescript
Person.from({
  name: 'Test',
  age: 19.999978,
  address: {
    street1: '1234 Fun',
    street2: 'Unit 20'
  }
});
```

and the output would be a `Person` instance with the following structure
```typescript
Person(
  name: 'Test',
  age: 20,
  address: Address(
    street1: '1234 Fun',
    street2: 'Unit 20'
  )
)
```

**NOTE** Binding will attempt to convert/coerce types as much as possible to honor the pattern of Javascript and it's dynamic nature.

### Validation
Validation is very similar to binding, but instead of attempting to assign values, any mismatch or violation of the schema will result in all errors being collected and returned.

Given the same schema as above, 

```typescript
@Schema()
class Address {
  street1: string;
  street2: string;
}

@Schema()
class Person {
  name: string;
  @Integer() age: number;
  address: Address;
}
```

But now with an invalid json object
```typescript
const person = Person.from({
  name: 'Test',
  age: 'abc',
  address: {
    street1: '1234 Fun'
  }
});

try {
  await SchemaValidator.validate(person);
} catch (e) {
  if (e instanceof ValidationErrors) {
    ... Handle errors ...
  }
}
```

would produce an exception similar to following structure
```yaml
errors:
  - 
    path: age
    kind: type
    message: 'abc' is not assignable to type number
  - 
    path: address.street2
    kind: required
    message: address.street2 is a required field
```

## Extensions
Integration with other modules can be supported by extensions.  The dependencies are `peerDependencies` and must be installed directly if you want to use them:

### Express
The module provides high level access for [`Express`](https://github.com/travetto/express) support, via decorators, for validating and typing request bodies.  

## Decorators
`@SchemaBody` provides the ability to convert the inbound request body into a schema bound object, and provide validation before the controller even receives the request.
 ```typescript
 class User {
   name: string;
   age: number;
 }
 ...
  @Post('/saveUser')
  @SchemaBody(User)
  async save(req: TypedBody<User>) {
    const user = await this.service.update(req.body);
    return { success : true };
  }
 ...
 ```
`@SchemaQuery` provides the ability to convert the inbound request query into a schema bound object, and provide validation before the controller even receives the request. 
```typescript
 class SearchParams {
   page: number = 0;
   pageSize: number = 100;
 }
 ...
  @Get('/search')
  @SchemaQuery(SearchParams)
  async search(req: TypedQuery<SearchParams>) {
    return await this.service.search(req.query);
  }
 ...
 ```

