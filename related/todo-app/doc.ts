import {
  doc as d, RawHeader, lib, mod, List, Section,
  Terminal, fld, pth, Code, SnippetLink, Execute, DocUtil, Hidden, Ref
} from '@travetto/doc';
import { Model } from '@travetto/model';

const ModelType = SnippetLink('ModelType', '@travetto/model/src/types/model.ts', /./);

export const header = false;
export const toc = 'Overview';
export const text = d`
${RawHeader('Getting Started: A Todo App')}

The following tutorial wil walk you through setting up a ${lib.Travetto} application from scratch.  We'll be building a simple todo application. The entire source of the finished project can be found at ${Ref('Todo App', __dirname)}.  Additionally, you can use the ${mod.GeneratorApp}.

${Section('Prerequisites')}

Install
${List(
  d`${lib.NodeDownload} v12.x + (required)`,
  d`${lib.MongoDownload} 3.6+ (required)`,
  d`${lib.VSCodeDownload} (recommended)`,
  d`${lib.TravettoPlugin} (recommended)`
)}

${Section('Project Initialization')}

${Terminal('Getting Ready', `
$ mkdir todo-project
$ cd todo-project

$ git init .

$ npm init -f
$ npm i @travetto/{log,test,rest-express,model-mongo}
`)}

${Section('Establishing The Model')}

Let's create the model for the todo application.  The fields we will need should be:

${List(
  d`${fld`id`} as a unique identifier`,
  d`${fld`text`} as the actual todo information`,
  d`${fld`created`} the date the todo was created`,
  d`${fld`completed`} whether or not the todo was completed`,
)}

Create the file ${pth`src/model.ts`}

${Code('Models', 'src/model.ts')}

as you can see, the model structure is simple.  Everything that uses the ${Model} services needs to implement ${ModelType}.

${Section('Building the Service Layer')}

Next we establish the functionality for the service layer. The operations we need are:
${List(
  'Create a new todo',
  'Complete a todo',
  'Remove a todo',
  'Get all todos',
)}

Now we need to create ${pth`src/service.ts`}

${Code('Service Definition', 'src/service.ts')}

${Section('Writing Unit tests')}

After we have established our service layer, we will now construct some simple tests to verify the service layer is running correctly. By default we set the database schema name under ${pth`test/resources/application.yml`} to ensure we aren't writing to our dev database.

${Code('Test YAML', 'test/resources/application.yml')}

Now the tests should be defined at ${pth`test/service.ts`}

${Code('Test bed', 'test/service.ts')}

${Section('Adding Rest Routes')}
Now we establish the routes, providing an interface to the service layer.

Finally, we establish the controller at ${pth`src/route.ts`}

${Code('Controller contents', 'src/route.ts')}

${Section('Running the App')}

First we must start the application:

${Execute('Application Startup', 'doc/startup.sh')} ${Hidden(DocUtil.run('doc/run-server.sh', []))}

next, let's execute ${lib.Curl} requests to interact with the new api:

${Code('Creating Todo by curl', 'doc/create.sh')}

${Execute('Create Output', 'doc/create.sh')}

${Code('Listing Todos by curl', 'doc/list.sh')}

${Execute('Listing Output', 'doc/list.sh')}
`;

DocUtil.run('doc/stop-server.sh', []);