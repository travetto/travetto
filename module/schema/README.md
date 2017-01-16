encore: Schema
===

This module provides more constrained access to Mongo DB.  This is achieved using the following:

  - Decorator based definition of Mongoose validators as well as general metadata
     - `@Field` defines a field that will be serialized
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

export function View(     
  - `Express` based support (optional).  This will not be exported via the barrel import, but
    can be pulled in if `express` is loaded.    
     - `@SchemaBody` provides the ability to convert the inbound request body into a schema bound object, and provide
       validation before the controller even receives the request.
     - `@SchemaQuery` provides the ability to convert the inbound request query into a schema bound object, and provide
       validation before the controller even receives the request.