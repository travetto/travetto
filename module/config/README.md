encore: Init
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
  - Ready
    - This provides mechanisms to define the following:
       - Define application readiness based on promises
       - Wait for application readiness to trigger certain actions post setup       