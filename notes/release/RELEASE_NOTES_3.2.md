# Travetto 3.2 Release Notes

> Release 3.2.0: 2023-06-25 -- You're an All-star

## Major/Breaking Changes

## Upgrade to Typescript 5.1
* Upgrade to Typescript 5.1

## Email Overhaul
* @travetto/email-template has been split into
   - @travetto/email-compiler (Takes templated content and produces the sass/image inlined files)
   - @travetto/email-inky (Now JSX components for producing email templates)

## Rest Client
* @travetto/rest-client is now a light-weight alternative to using @travetto/openapi's generator program

## Pack Rollup
* @travetto/pack now supports full customization of rollup behavior

## Model Enhancements
* @travetto/model-query, Exists now returns false on empty arrays
* @travetto/model+schema Standardized inheritance metadata and how lookups happen

## Native Fetch
* Shifted entire framework over to native fetch (default enabled as of Node 18+).  

## Auth Cleanup
* @travetto/rest-auth-jwt now allows for auto regenerating a new token depending on how close the token is to expiration.  When combined with the cookie encoder, this provides a mode in which the user will continue to renew the token, providing a semblance of the session timeout/renewal.
* @travetto/rest-auth-context has been deprecated, and this functionality is now basked into @travetto/auth-rest

## Rest/schema
* Standardization of all Query-based complex types (e.g. schema-backed objects mapped to query params) - We now have consistency between OpenAPI, Rest, and Rest-Client on how these types will be handled, and how prefixing of values will apply.
