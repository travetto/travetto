encore: Express
===

This module provides three main areas of functionality:

   - Route management 
      - Define a route scope using `@Controller` on a class
      - Define individual routes using `@Get`, `@Post`, `@Put`, `@Delete` on a static method of the class
      - Supports `async` methods for route handlings vs `next` callbacks
   - Input/Output
      - Provides interfaces for supporting renderable content
      - Provides interfaces to define request bodies being typed
   - App initialization
      - Provides standard set of filters for express
      - Supports configuration on the `express` namespace
         - Also handles session management
      - Provides a `bootstrap.js` that is a target point for standard app initialization.
        Not required to be used, but can easily suffice as the main entry point for the
        application.