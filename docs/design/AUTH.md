# Auth

## Core entities

* Identity - An authenticated user
* Principal - An authorized user
* AuthContext - The combination of Identity and Principal where
  * Principal is optional
  * And if principal is missing, the identity acts as the principal

## Core Modules
* Auth -
  * responsible for maintaining the authcontext
  * Responsible for resolving principal from an identity
* Auth-Passport 
  * Integration of passport as an identity provider
  * Independent of *Auth*
  * Only responsible for calling auth to attempt to login
* Auth-Model
  * Integration of `@travetto/model` as an identity provider
  * Independent of *Auth*
  * Only responsible for calling auth to attempt to login
* Auth-Rest
  * Exposes identity providers as direct routes
  * Exposes core security functionality as request methods/properties
  * Exposes decorators to enforce security
  * Allows *Auth* to be initialized from request data (Headers/Cookies/Params)

## Supported Flows

```yaml
Participant User
Participant Ext Auth Server
Participant App Server
Participant Auth Context
Participant App DB

alt Check Login
User->App Server: Hit status endpoint
App Server->Auth Context: Detect User is not authenticated
App Server->User: Return status
end

alt Fresh Login, user is not logged in 
User->Ext Auth Server: Provided external auth ui to authenticate
Ext Auth Server->App Server: Provides authenticated user context
App Server->App DB: Find corresponding user by include
App Server->Auth Context: Initialize user state
App Server->User: Convert user user state into auth token
end

alt Request with token
User->App Server: Send token while requesting resource
App Server->Auth Context: Validate and Convert token into user state
App Server->Auth Context: Validate resource permissions
App Server->User: Send response
end

alt Request with expired token
User->App Server: Send token while requesting resource
App Server->Auth Context: Detect expired token
App Server->User: Send 403
end
```