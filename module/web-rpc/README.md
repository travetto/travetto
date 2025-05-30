<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/web-rpc/DOC.tsx and execute "npx trv doc" to rebuild -->
# Web RPC Support

## RPC support for a Web Application

**Install: @travetto/web-rpc**
```bash
npm install @travetto/web-rpc

# or

yarn add @travetto/web-rpc
```

This module allows for a highly focused scenario, of supporting RPC operations within a [Web API](https://github.com/travetto/travetto/tree/main/module/web#readme "Declarative support for creating Web Applications") application.  The module takes care of producing the appropriate handler for the RPC commands along with the ability to generate the appropriate client to be used to interact with the RPC functionality.  The generated client uses Proxy-based objects, along with [Typescript](https://typescriptlang.org) magic to create a dynamic client that does not rely on generating a lot of code.

## CLI - web:rpc-client
The library will create the RPC client in one of three flavors: fetch, fetch + node, angular.

**Terminal: Command Service**
```bash
$ trv web:rpc-client --help

Usage: web:rpc-client [options] <type:config|node|web> [output:string]

Options:
  -e, --env <string>     Application environment
  -m, --module <module>  Module to run for
  -h, --help             display help for command
```

## Example

**Code: Example Controller**
```typescript
import { Controller, Get } from '@travetto/web';

@Controller('/draft')
export class DraftController {

  @Get('/suggest/tags')
  async getTags(q?: string): Promise<string[]> {
    return [.../* To fill in */[q ?? '']];
  }
}
```

This controller is a basic example of an invokable endpoint.

**Config: resources/application.yml**
```yaml
web.rpc:
  clients:
    - type: web
      output: ./api-client
```

The configuration, while not necessary, makes it easy to consistently configure and generate the appropriate client.

**Terminal: Example Client Generation**
```bash
npx trv web:rpc-client config
```

You can manually invoke the client generation, but once configured, it will run automatically when running the web server as well.

**Code: Example API Factory**
```typescript
import { clientFactory } from './rpc';
import type { DraftController } from '../.trv/types/node_modules/@travetto-doc/web-rpc/src/controller.js';

export const factory = clientFactory<{
  DraftController: DraftController;
}>();
```

The api factory relies on the type information generated by the compiler, and so this file is the only configuration needed to connect your controllers to the rpc functionality.

**Code: Example Client Usage**
```javascript
import { factory } from '../api-client/factory';

const client = factory({ url: 'http://localhost:3000' });

client.DraftController.getTags('prefix').then(result => {
  console.log('Found', result);
});
```

The usage here is extremely simple, but outlines the simplicity of what is needed to make RPC requests.
