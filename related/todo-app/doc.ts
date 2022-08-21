import * as timers from 'timers/promises';

import { d, lib, mod } from '@travetto/doc';
import { DocRunUtil } from '@travetto/doc/src/util/run';
import { Model } from '@travetto/model';

const ModelType = d.SnippetLink('ModelType', '@travetto/model/src/types/model.ts', /./);

process.env.TRV_LOG_PLAIN = '0';

export const text = async () => {

  const startupBuffer: Buffer[] = [];

  const cmd = DocRunUtil.runBackground('trv', ['run', 'rest'], {
    env: { REST_LOGROUTES_PATHS: '!*', REST_PORT: '12555' }
  });

  cmd.process.stdout?.on('data', v =>
    startupBuffer.push(Buffer.from(v)));

  while (startupBuffer.length === 0) {
    await timers.setTimeout(100);
  }

  await timers.setTimeout(1000);

  const startupOutput = DocRunUtil.cleanRunOutput(Buffer.concat(startupBuffer).toString('utf8'), {});

  const result = d`
${d.RawHeader('Getting Started: A Todo App')}

The following tutorial wil walk you through setting up a ${lib.Travetto} application from scratch.  We'll be building a simple todo application. The entire source of the finished project can be found at ${d.Ref('Todo App', __dirname)}.  Additionally, you can use the ${mod.Scaffold}.

${d.TableOfContents('Overview')}

${d.Section('Prerequisites')}

Install
${d.List(
    d`${lib.NodeDownload} v15.x+ (recommended, but v12.x+ supported)`,
    d`${lib.MongoDownload} 3.6+ (required)`,
    d`${lib.VSCodeDownload} (recommended)`,
    d`${lib.TravettoPlugin} (recommended)`
  )}

${d.Section('Project Initialization')}

${d.Terminal('Getting Ready', `
$ mkdir todo-project
$ cd todo-project

$ git init .

$ npm init -f
$ npm i @travetto/{log,test,rest-express,model-mongo}
`)}

${d.Section('Establishing The Model')}

Let's create the model for the todo application.  The fields we will need should be:

${d.List(
    d`${d.Field('id')} as a unique identifier`,
    d`${d.Field('text')} as the actual todo information`,
    d`${d.Field('created')} the date the todo was created`,
    d`${d.Field('completed')} whether or not the todo was completed`,
  )}

Create the file ${d.Path('src/model.ts')}

${d.Code('Models', 'src/model.ts')}

as you can see, the model structure is simple.  Everything that uses the ${Model} services needs to implement ${ModelType}.

${d.Section('Building the Service Layer')}

Next we establish the functionality for the service layer. The operations we need are:
${d.List(
    'Create a new todo',
    'Complete a todo',
    'Remove a todo',
    'Get all todos',
  )}

Now we need to create ${d.Path('src/service.ts')}

${d.Code('Service Definition', 'src/service.ts')}

${d.Section('Writing Unit tests')}

After we have established our service layer, we will now construct some simple tests to verify the service layer is running correctly. By default we set the database schema name under ${d.Path('test/resources/application.yml')} to ensure we aren't writing to our dev database.

${d.Code('Test YAML', 'test/resources/application.yml')}

Now the tests should be defined at ${d.Path('test/service.ts')}

${d.Code('Test bed', 'test/service.ts')}

${d.Section('Adding Rest Routes')}
Now we establish the routes, providing an interface to the service layer.

Finally, we establish the controller at ${d.Path('src/route.ts')}

${d.Code('Controller contents', 'src/route.ts')}

${d.Section('Running the App')}

First we must start the application:

${d.Terminal('Application Startup', startupOutput)}

next, let's execute ${lib.Fetch} requests to interact with the new api:

${d.Code('Creating Todo by fetch', 'doc/create-todo.ts')}

${d.Execute('Create Output', 'doc/create-todo.ts', [], { env: { TRV_LOG_PLAIN: '1' }, module: 'boot' })}

${d.Code('Listing Todos by fetch', 'doc/list-todo.ts')}

${d.Execute('Listing Output', 'doc/list-todo.ts', [], { env: { TRV_LOG_PLAIN: '1' }, module: 'boot' })}
`;

  // Wrap it up
  cmd?.process.kill('SIGKILL');

  return result;
};