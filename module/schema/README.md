travetto: Schema
===

**Install: primary**
```bash
$ npm install @travetto/schema
```

This module provide a mechanisms for registering classes and field level information as well the ability to apply that information at runtime.

## Registration
The registry's schema information is defined by `typescript` AST and only applies to classes registered with the `@Schema` decoration. 

### Classes
The module utilizes AST transformations to collect schema information, and facilitate the registration process without user intervention. The class can also be described using providing a:
* `title` - definition of the schema
* `description` - detailed description of the schema
* `examples` - A set of examples as JSON or YAML

The `title` will be picked up from the [`JSDoc`](http://usejsdoc.org/about-getting-started.html) comments, and additionally all fields can be set using the [`@Describe`](./src/decorator/common) decorator.

**Code: Sample User Schema**
```typescript
@Schema()
class User {
  name: string;
  age: number;
  favoriteFood?: 'pizza'|'burrito'|'salad';
}
```
From this schema, the registry would have the following information:

**Config: User schema as yaml**
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

### Fields
This schema provides a powerful base for data binding and validation at runtime.  Additionally there may be types that cannot be detected, or some information that the programmer would like to override. Below are the supported field decorators:

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
 * `@Currency` provides support for standard currency
 * `@Text` indicates that a field is expecting natural language input, not just discrete values
 * `@LongText` same as text, but expects longer form content

Additionally, schemas can be nested to form more complex data structures that are able to bound and validated.

Just like the class, all fields can be defined with
* `description` - detailed description of the schema
* `examples` - A set of examples as JSON or YAML

And similarly, the `description` will be picked up from the [`JSDoc`](http://usejsdoc.org/about-getting-started.html) comments, and additionally all fields can be set using the [`@Describe`](./src/decorator/common) decorator.

## Binding/Validation
At runtime, once a schema is registered, a programmer can utilize this structure to perform specific operations. Specifically binding and validation. 

### Binding
Binding is a very simple operation, as it takes in a class registered as as `@Schema` and a JS object that will be the source of the binding. Given the schema

**Code: Sub Schemas via Address**
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

**Code: Binding from JSON to Schema**
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

**Code: Sample data output after binding**
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
Validation is very similar to binding, but instead of attempting to assign values, any mismatch or violation of the schema will result in errors. All errors will be collected and returned. Given the same schema as above, 

**Code: Reference Schema for Validations**
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

**Code: Read Person, and validate**
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
  if (e instanceof ValidationError) {
    ... Handle errors ...
  }
}
```

would produce an exception similar to following structure

**Config: Sample error output**
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

### Custom Validators
Within the schema framework, it is possible to add custom validators class level.  This allows for more flexibility when dealing with specific situations (e.g. password requirements or ensuring two fields match)

**Code: Password Validator**
```ts
const passwordValidator = (user: User) => {
  const p = user.password;
  const hasNum = /\d/.test(p);
  const hasSpecial = /[!@#$%%^&*()<>?/,.;':"']/.test(p);
  const noRepeat = !/(.)(\1)/.test(p);
  if (!hasNum || !hasSpecial || !noRepeat) {
    return {
      kind: 'password-rules',
      path: 'password',
      message: 'A password must include at least one number, one special char, and have no repeating characters'
    };
  }
}

@Schema()
@Validator(passwordValidator)
class User {
  password: string;
}
```

When the validator is executed, it has access to the entire object, and you can check any of the values.  The validator expects an object of a specific structure if you are looking to indicate an error has occurred.

**Code: Validation Error**
```js
  {
    kind: '<what type of error is it>',
    path: '<which field, or field path did the error occur at>',
    message: '<human readable message to indicate what the error was>'
  }
```

## Rest - Extension
The module provides high level access for [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) support, via decorators, for validating and typing request bodies.  

`@SchemaBody` provides the ability to convert the inbound request body into a schema bound object, and provide validation before the controller even receives the request.
 
**Code: Using SchemaBody for POST requests**
```typescript
 import { SearchBody } from '@travetto/schema/src/extension/rest';

class User {
   name: string;
   age: number;
 }
 ...
  @Post('/saveUser')  
  async save(@SchemaBody() user: User) {
    const user = await this.service.update(user);
    return { success : true };
  }
 ...
 ```

`@SchemaQuery` provides the ability to convert the inbound request query into a schema bound object, and provide validation before the controller even receives the request. 

**Code: Using SchemaQuery for GET requests**
```typescript
 import { SchemaQuery } from '@travetto/schema/src/extension/rest';

 class SearchParams {
   page: number = 0;
   pageSize: number = 100;
 }
 ...
  @Get('/search')  
  async search(@SchemaQuery() query: SearchParams) {
    return await this.service.search(query);
  }
 ...
 ```

 ## Generation - Extension

In the course of application development, there is often a need to generate fake data on demand. Given all the information that we have about the schemas provided, translating that into data generation is fairly straightforward.  The generation utility is built upon [`faker`](https://github.com/marak/Faker.js/), mapping data types, and various field names into specific `faker` generation routines.

By default all types are mapped as-is:
* `string`
* `number`
* `Date`
* `boolean`
* Enumerations as `string` or `number` types.
* Provided regular expressions:
  * email
  * url
  * telephone
  * postal_code
* Sub-schemas as registered via `@Schema` decorators.

In addition to the general types, the code relies upon name matching to provide additional refinement:
* string
 * `/^(image|img).*url$/` - image.imageUrl
 * `/^url$/` - internet.url
 * `/^email(addr(ress)?)?$/` - internet.email
 * `/^(tele)?phone(num|number)?$/` - phone.phoneNumber
 * `/^((postal|zip)code)|zip$/` - address.zipCode
 * `/f(irst)?name/` - name.firstName
 * `/l(ast)?name/` - name.lastName
 * `/^ip(add(ress)?)?$/` - internet.ip
 * `/^ip(add(ress)?)?(v?)6$/` - internet.ipv6
 * `/^username$/` - internet.userName
 * `/^domain(name)?$/` - internet.domainName
 * `/^file(path|name)?$/` - system.filePath
 * `/^street(1)?$/` - address.streetAddress
 * `/^street2$/` - address.secondaryAddress
 * `/^county$/` - address.county
 * `/^country$/` - address.country
 * `/^state$/` - address.state
 * `/^lon(gitude)/` - address.longitude
 * `/^lat(itude)/` - address.latitude
 * `/(profile).*(image|img)/` - image.avatar
 * `/(image|img)/` - image.image
 * `/^company(name)?$/` - company.companyName
 * `/(desc|description)$/` - lorem.sentences(10)
* Date
 * `/dob|birth/` - date.past(60)
 * `/creat(e|ion)/` - dates between 200 and 100 days ago
 * `/(update|modif(y|ied))/` - dates between 100 and 50 days ago
* number
 * `/(price|amt|amount)$/` - parseFloat(finance.amount()

An example of this would be:

**Code: More complex Schema, used with Faker**
```typescript

@Schema()
class Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  country: string;
}

@Schema()
class User {
  fName: string;
  lName: string;
  email: string;
  phone: string;
  dob?: Date;
  address: Address;
}

const user = GenerateUtil.generate(User);
assert(user instanceof User);
assert.ok(user.fName);
assert.ok(user.address);
assert(user.address instanceof Address);

```

## Custom Types
When working with the schema, the basic types are easily understood, but some of Typescript's more complex constructs are too complex to automate cleanly.  
To that end, the module supports two concepts:

### Type Adapters
This feature is meant to allow for simple Typescript types to be able to be backed by a proper class.  This is because all of the typescript type information disappears at runtime, and so only concrete types (like classes) remain.  An example of this, can be found with how the [`Model`](https://github.com/travetto/travetto/tree/master/module/model) module handles geo data.

**Code: Simple Custom Type**
```typescript
/**
 * @concrete Point
 */
export type Point = [number, number];

export const Point = class Point {
  static validateSchema(input: any) {
    const ret = this.bindSchema(input);
    return ret && !isNaN(ret[0]) && !isNaN(ret[1]) ? undefined : 'type';
  }

  static bindSchema(input: any): [number, number] | undefined {
    if (Array.isArray(input) && input.length === 2) {
      return input.map(x => Util.coerceType(x, Number, false)) as [number, number];
    }
  }
};
```

What you can see here is that the `Point` type is now backed by a class that supports:
* `validateSchema` - Will run during validation for this specific type.
* `bindSchema` - Will run during binding to ensure correct behavior.

**Code: Simple Custom Type Usage**
```typescript
import { Point } from '@travetto/model';

@Schema()
class LocationAware {
  name: string;
  point: Point;
}
```

All that happens now, is the type is exported, and the class above is able to properly handle point as an `[x,y]` tuple.  All standard binding and validation patterns are supported, and type enforcement will work as expected. 