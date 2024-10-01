<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/rest-rpc/DOC.tsx and execute "npx trv doc" to rebuild -->
# RESTful RPC Support

## RESTful RPC support for a module

**Install: @travetto/rest-rpc**
```bash
npm install @travetto/rest-rpc

# or

yarn add @travetto/rest-rpc
```

This module allows for a highly focused scenario, of supporting RPC operations within a [RESTful API](https://github.com/travetto/travetto/tree/main/module/rest#readme "Declarative api for RESTful APIs with support for the dependency injection module.") application.  The module takes care of producing the appropriate interceptor to handle the RPC commands along with the ability to generate the appropriate client to be used to interact with the RPC functionality.  The client uses Proxy-based objects, along with [Typescript](https://typescriptlang.org) magic to create a dynamic client that is not generated.

## CLI - rest:rpc
The library will create the RPC client in one of three flavors: fetch, fetch + node, angular.

**Terminal: Command Service**
```bash
$ trv rest:rpc --help

Usage: rest:rpc [options] <type:angular|config|node|web> [output:string]

Options:
  -e, --env <string>     Application environment
  -m, --module <module>  Module to run for
  -h, --help             display help for command
```