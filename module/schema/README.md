encore: Schema
===

This module provides more constrained access to Mongo DB.  This is achieved using the following:

  - Mongoose-based validations (not query)
  - Decorator based definition of Mongoose validators as well as general metadata
     - `@Field` defines a field that will be serialized
     - `@Unique` defines a unique index
     - `@Index` defines a general index
     - `@Require` defines a required field
     - `@Enum` defines a field with only enumerated values
     - `@Discriminate` defines the ability to have multiple classes share a collection space
  - `Express` based support (optional).  This will not be exported via the barrel import, but
    can be pulled in if `express` is loaded.    
     - `@ModelBody` provides the ability to convert the inbound request into a model, and provide
       validation before the controller even receives the request.