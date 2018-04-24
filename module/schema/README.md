travetto: Schema
===

This module provide validation for data schemas. The module uses AST transformations to 
modify `class`es at runtime, to annotate with types, and whether or not fields are 
required/optional.  Additionally, for constraints that are not immediately discernable,
the following are available:

  - Class level
     - `@Schema` defines a class to be a validated, will auto detect schema from typescript annotations

  - Decorator based definition of Mongoose validators as well as general metadata
     - `@Field` defines a field that will be serialized (if not using auto `@Schema()`)
     - `@Require` defines a required field
     - `@Enum` defines a field with only enumerated values
     - `@Trimmed` whitespace trims the field
     - `@Match` allows for regex validation on a field
     - `@MinLength` enforces min length of a string
     - `@MaxLength` enforces max length of a string
     - `@Min` enforces min value for a date or a number
     - `@Max` enforces max value for a date or a number
     - `@Email` ensures string field matches basic email regex
     - `@Telephone` ensures string field matches basic telephone regex
     - `@Url` ensures string field matches basic url regex
     - `@Ignore` exclude from auto schema registration