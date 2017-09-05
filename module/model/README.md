encore: Model
===

This module provides more constrained access to Mongo DB.  This is achieved using the following:

  - Mongoose-based validations (not query)
  - Decorator based definition of mongo operations
     - `@Unique` defines a unique index
     - `@Index` defines a general index
     - `@SubType` defines the ability to have multiple classes share a collection space
  - `BaseModel` to provide common mechanism for all base models (construction from plain objects)
