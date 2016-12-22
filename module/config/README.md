encore: Config 
===

This module provides common infrastructure for application based initialization.  There is a common
infrastructure pattern used:
  - Configuration
    - A scan for all `src/app/**/config.ts`.  
    - Each `config.ts` file must call `registerNamespace` to define a new configuration 
      namespace.  
    - Every configuration property can be overridden via environment variables (case-insensitive).
       - Object navigation is separated by underscores
       - e.g. `MAIL_TRANSPORT_HOST` would override `mail.transport.host` and specifically `transport.host`
         in the `mail` namespace.
    - All configuration variables should be loaded before any modules use it. 
    - `config.ts` should not require any code from your modules to ensure the order of loading 
  - Bootstrap
    - Supports initializing the application, and then requiring classes using a glob pattern 
      to handle the common initialization process.
