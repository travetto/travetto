# Travetto 1.1 Release Notes

> Release 1.1.0: 2020-09-20 -- Incremental Improvements

### Major changes
* @travetto/pack is a new module that supports packing applications. 
* The @travetto/email-template development UI has been externalized into the VSCode Plugin.  Additionally some other enhancements have been made to the templating process.
* @travetto/cache now supports DynamoDB as a valid storage model
* @travetto/rest-fastify properly supports running a lambda context using the aws-lambda-fastify module.  

### Minor changes
* Moved typescript to require 4.0.0 or higher.

### Breaking changes
* @travetto/app has disconnected itself from the rest module and is now a standalone service, when desiring to run the application via the app module.
* @travetto/email-template now uses .email.html as the template suffix.
* @travetto/email-template the email dev UI has been removed.
