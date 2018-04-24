travetto: Express
===

Provides a declarative API for registering routes for an application.

- Route management 
  - Define a route scope using `@Controller` on a class
  - Define individual routes using `@Get`, `@Post`, `@Put`, `@Delete` on a static method of the class
  - Supports `async` methods for route handlings vs `next` callbacks
  - *DEV* mode will allow for hot reloading of `class`es at runtime

- Input/Output
  - Provides interfaces for supporting renderable content
  - Provides interfaces to define request bodies being typed
  
- App initialization
  - Provides standard set of filters for express
    - Allows for discoverable operators that can be picked up at runtime
  - Supports configuration on the `express` namespace
     - Also handles session management

Additionally, there are some extensions that can be loaded, by directly importing the files:

- `Schema` support for typing requests 
 - `@SchemaBody` provides the ability to convert the inbound request body into a schema bound object, and provide
   validation before the controller even receives the request.
 - `@SchemaQuery` provides the ability to convert the inbound request query into a schema bound object, and provide
   validation before the controller even receives the request.   

- `Context` support for automatically injecting an async context into every request