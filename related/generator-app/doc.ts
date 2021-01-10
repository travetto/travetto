import { doc as d, lib, Header, Install, Section, Terminal, Mod, inp, List, pth, SubSection, Code, Ref } from '@travetto/doc';

const Todo = Ref('Todo', './templates/todo/src/model/todo.ts');

exports.header = false;
exports.text = d`
${Header(__dirname, false)}

A simple ${lib.Yeoman} generator for scaffolding a reference project.  To get started, you need to make sure:

${Install(`Setting up yeoman and the generator`, `
$ npm i -g yo #Ensure yeoman is installed globally
$ npm i -g @travetto/generator-app #Ensure this yeoman generator is installed
$ git config --global.username <Username> #Set your git username
`)}

Once installed you can invoke the scaffolding by running

${Terminal('Running Generator', `$ yo @travetto/app`)}

The generator will ask about enabling the following features:

${Section('Restful Architecture')}
The ${Mod('rest')} provides the necessary integration for exposing restful apis.  When selecting the ${inp`rest`} feature, you will need to specify which backend you want to include with your application, the default being ${lib.Express}.  Currently you can select from:

${List(
  lib.Express,
  lib.Koa,
  lib.Fastify,
)}

The code will establish some basic routes, specifically, ${inp`GET / `} as the root endpoint.  This will return the contents of your ${pth`package.json`} as an identification operation.

${SubSection('Additional Rest Features')}
In addition to the core functionality, the ${inp`rest`} feature has some useful sub-features.  Specifically:

${Mod('openapi')} support for the restful api.  This will automatically expose a ${pth`openapi.yml`} endpoint, and provide the necessary plumbing to support client generation.

${Mod('log')} support for better formatting, ${lib.Debug} like support, and colorized output.  This is generally useful for server logs, especially during development.

${Section('Authentication')}
Authentication is also supported on the Restful endpoints by selecting ${Mod('auth-rest')} during setup.  This will support basic authentication running out of local memory, with user ${Mod('rest-session')}s.

${Section('Testing')}
${Mod('test')} can also be configured out of the box to provide simple test cases for the data model.

${Section('Data Modelling and Storage')}

The ${Mod('model')} allows for modeling of application data, and provides mechanisms for storage and retrieval.  When setting up your application, you will need to select which database backend you want to use:

${List(
  lib.Elasticsearch,
  lib.MongoDB,
  lib.SQL,
)}


A default model is constructed, a ${Todo} class:

${Code('Todo Model', Todo.link.content)}

Basic tests are also included for the ${inp`model`} to verify that database interaction and functionality is working properly.

${Section('Rest + Model')}
In the case both ${inp`rest`} and ${inp`model`} features are enabled, the code will produce a controller that exposes the ${Todo} model via restful patterns.

${Code('Todo controller', './templates/todo/src/rest/todo.ts')}

${Section('Running')}

Once finished the application will reflect the modules chosen, and will be ready for execution, if you have configured a runnable application.  Currently, this requires the ${inp`rest`} feature to be selected.

${Terminal('Starting the App', 'npm start')}
`;