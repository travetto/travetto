import { d, lib, mod } from '@travetto/doc';

import { Todo } from './templates/todo/src/model/todo';
import { TodoController } from './templates/todo/src/rest/todo';

export const text = d`
${d.Header(false)}

A simple tool for scaffolding a reference project.  To get started, you need to make sure:

${d.Install('Setting up the necessary config', `
$ git config --global.username <Username> #Set your git username
`)}

Once installed you can invoke the scaffolding by running

${d.Terminal('Running Generator', '$ npx @travetto/scaffold')}

The generator will ask about enabling the following features:

${d.Section('Restful Architecture')}
The ${mod.Rest} provides the necessary integration for exposing restful apis.  When selecting the ${d.Input('rest')} feature, you will need to specify which backend you want to include with your application, the default being ${lib.Express}.  Currently you can select from:

${d.List(
  lib.Express,
  lib.Koa,
  lib.Fastify,
)}

The code will establish some basic routes, specifically, ${d.Input('GET / ')} as the root endpoint.  This will return the contents of your ${d.Path('package.json')} as an identification operation.

${d.SubSection('Additional Rest Features')}
In addition to the core functionality, the ${d.Input('rest')} feature has some useful sub-features.  Specifically:

${mod.Openapi} support for the restful api.  This will automatically expose a ${d.Path('openapi.yml')} endpoint, and provide the necessary plumbing to support client generation.

${mod.Log} support for better formatting, ${lib.Debug} like support, and colorized output.  This is generally useful for server logs, especially during development.

${d.Section('Authentication')}
Authentication is also supported on the Restful endpoints by selecting ${mod.AuthRest} during setup.  This will support basic authentication running out of local memory, with user ${mod.RestSession}s.

${d.Section('Testing')}
${mod.Test} can also be configured out of the box to provide simple test cases for the data model.

${d.Section('Data Modelling and Storage')}

The ${mod.Model} allows for modeling of application data, and provides mechanisms for storage and retrieval.  When setting up your application, you will need to select which database backend you want to use:

${d.List(
  lib.Elasticsearch,
  lib.MongoDB,
  lib.SQL,
  lib.DynamoDB,
  lib.Firestore,
)}

A default model is constructed, a ${Todo} class:

${d.Code('Todo Model', Todo.ᚕfile)}

Basic tests are also included for the ${d.Input('model')} to verify that database interaction and functionality is working properly.

${d.Section('Rest + Model')}
In the case both ${d.Input('rest')} and ${d.Input('model')} features are enabled, the code will produce a controller that exposes the ${Todo} model via restful patterns.

${d.Code('Todo controller', TodoController.ᚕfile)}

${d.Section('Running')}

Once finished the application will reflect the modules chosen, and will be ready for execution, if you have configured a runnable application.  Currently, this requires the ${d.Input('rest')} feature to be selected.

${d.Terminal('Starting the App', 'npm start')}
`;