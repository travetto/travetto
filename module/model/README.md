travetto: Model
===

**Install: primary**
```bash
$ npm install @travetto/model
```

This module provides a clean interface to data model persistence, modification and retrieval.  This module builds heavily upon the [`Schema`](https://github.com/travetto/travetto/tree/master/module/schema), which is used for data model validation.

The module can be segmented into three main areas: Model declaration, access/storage, and querying

## Declaration
Models are declared via the `@Model` decorator, which allows the system to know that this is a class that is compatible with the module.

**Code: Extending BaseModel**
```typescript
@Model()
class User extends BaseModel {
  name: string;
  age: number;
  contact?: boolean;
}
```

The `User` model is now ready to be used with the model services.

## Access/Storage
The [`ModelService`](./src/service/model.ts) is the foundation for all access to the storage layer, and provides a comprehensive set of functionality.  The service includes support for modifying individual records, bulk update/insert/delete, partial updates, finding records, and more.  This should be the expected set of functionality for storage and retrieval.

**Code: Using ModelService with the User model**
```typescript
class UserManager {
  private service: ModelService;

  async register(user: User) {
    const created = await this.service.save(User, user);
    ... send welcome email ...
    return created;
  }

  async bulkCreate(users: User[]) {
    const res = await this.service.bulkProcess(User, {
      insert: users
    });
    ... notify administrator of completion ...
    return res; 
  }
}

```

The [`ModelService`](./src/service/model.ts) itself relies upon a [`ModelSource`](./src/service/source.ts) which is the driver for the storage layer.  

During development, `ModelSource` supports the ability to respond to model changes in real-time, and to modify the underlying storage mechanism.  An example of this would be `elasticsearch` schemas being updated as fields are added or removed from the `Model` class.

## Querying
One of the complexities of abstracting multiple storage mechanisms, is providing a consistent query language.  The query language the module uses is a derivation of `mongodb`'s query language, with some restrictions, additions, and caveats. Additionally, given the nature of typescript, all queries are statically typed, and will catch type errors at compile time.

### General Fields
```field : { $eq : T }``` to determine if a field is equal to a value
```field : { $ne: T }``` to determine if a field is not equal to a value
```field : { $exists : boolean }``` to determine if a field exists or not
```field : T``` to see if the field is equal to whatever value is passed in

### General Single Valued Fields
```field : { $in : T[] }``` to see if a record's value appears in the array provided to `$in`
```field : { $nin: T[] }``` to see if a record's value does not appear in the array provided to `$in`

### Ordered Fields
```field : { $lt: T }``` checks if value is less than
```field : { $lte: T }``` checks if value is less than or equal to
```field : { $gt: T }``` checks if value is greater than
```field : { $gte : T }``` checks if value is greater than or equal to

### Array Fields
```field : { $all: T[]] }``` checks to see if the records value contains everything within `$all`

### String Fields
```field : { $regex: RegExp | string; }``` checks the field against the regular expression

### Geo Point Fields
```field : { $geoWithin: Point[] }``` determines if the value is within the bounding region of the points
```field : { $near: Point, $maxDistance: number, $unit: 'km'|'m'|'mi'|'ft' }``` searches at a point, and looks out radially

### Groupings
```{ $and: [] }``` provides a grouping in which all sub clauses are required
```{ $or: [] }``` provides a grouping in which at least one of the sub clauses is required
```{ $not : {} }``` negates a clause

A sample query for `User`'s might be:

**Code: Using the query structure for specific queries**
```typescript
this.service.getAllByQuery(User, {
  $and: [
    { 
      $not : {
        age : {
          $lt : 35
        }
      }
    },
    {
      contact : {
        $exists: true
      }
    }
  ]
})
```

This would find all users who are over 35 and that have the `contact` field specified. 

## Query Language

In addition to the standard query interface, the module also supports querying by query language to facilitate end-user queries.  This is meant to act as an interface that is simpler to write than the default object structure.

The language itself is fairly simple, boolean logic, with parenthetical support.  The operators supported are:
* `<`,  `<=` - Less than, and less than or equal to
* `>`,  `>=` - Greater than, and greater than or equal to
* `!=`, `==` - Not equal to, and equal to
* `~` - Matches regular expression
* `!`, `not` - Negates a clause
* `in`, `not-in` - Supports checking if a field is in a list of literal values
* `and`, `&&` - Intersection of clauses
* `or`, `||` - Union of clauses

All sub fields are dot separated for access, e.g. `user.address.city`. A query language version of the previous query could look like:

**Code: Query language with boolean checks and exists check**
```sql
not (age < 35) and contact != null
```

A more complex query would look like:

**Code: Query language with more complex needs**
```sql
user.role in ['admin', 'root'] && (user.address.state == 'VA' || user.address.city == 'Springfield')
```

### Regular Expressions
When querying with regular expressions,patterns can be specified as `'strings'` or as `/patterns/`.  The latter allows for the case insensitive modifier: `/pattern/i`.  Supporting the insensitive flag is up to the underlying model implementation.

<!-- SUB -->

## Rest - Extension
To facilitate common RESTful patterns, the module exposes [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) support in the form of `@ModelController`.

**Code: ModelController example**
```typescript
@ModelController('/user', User) 
class UserController {
  @Inject()
  source: ModelService;
}
```
is a shorthand that is equal to:

**Code: Comparable UserController, built manually**
```typescript
@Controller('/user') 
class UserController {
  
  @Inject()
  source: ModelService;

  @Get('')
  async getAllUser(req:Request) {
    return await this.source.getAllByQuery(User, JSON.parse(req.params.q));
  }

  @Get(':id')
  async getUser(req:Request) {
    return await this.source.getById(User, req.params.id);
  }

  @Delete(':id')
  async deleteUser(req:Request) {
    return await this.source.deleteById(User, req.params.id);
  }

  @Post('')
  @SchemaBody(User)
  async saveUser(req:TypedBody<User>) {
    return await this.source.save(User, req.body);
  }

  @Put('')
  @SchemaBody(User)
  async updateUser(req:TypedBody<User>) {
    return await this.source.update(User, req.body);
  }
}
```