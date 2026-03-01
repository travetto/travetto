/** @jsxImportSource @travetto/doc/support */
import { d, c, type DocJSXElementByFn, type DocJSXElement, isDocJSXElement, DocRunUtil, PackageDocUtil } from '@travetto/doc';
import { Model, type ModelType } from '@travetto/model';
import { BinaryUtil, CodecUtil, Env, ExecUtil, RuntimeIndex, ShutdownManager, Util, castTo, toConcrete, type BinaryArray } from '@travetto/runtime';

const TodoRoot = d.ref('Todo App', RuntimeIndex.getModule('@travetto/todo-app')!.sourcePath);

const port = 12555;

async function init() {
  const startupBuffer: BinaryArray[] = [];

  DocRunUtil.run('trv', ['web:http', '--no-restart-on-change'], {
    env: {
      ...process.env,
      WEB_HTTP_PORT: `${port}`,
      WEB_HTTP_TLS: '0',
      WEB_BASE_URL: `http://localhost:${port}`,
      ...Env.TRV_ROLE.export('std'),
      ...Env.TRV_LOG_PLAIN.export(false),
    },
    spawn: (command, args, opts) => {
      const subProcess = ExecUtil.spawnPackageCommand(command, args, {
        ...opts,
        signal: ShutdownManager.signal
      });
      subProcess.stdout?.on('data', chunk => startupBuffer.push(CodecUtil.readUtf8Chunk(chunk)));
      return subProcess;
    },
  });

  while (startupBuffer.length === 0) {
    await Util.blockingTimeout(100);
  }

  await Util.blockingTimeout(1000);

  return DocRunUtil.cleanRunOutput(BinaryUtil.combineBinaryArrays(startupBuffer).toString('utf8'), {});
}

function TableOfContents({ root }: { root: () => DocJSXElement }) {
  const children = root().props.children ?? [];
  const final = Array.isArray(children) ? children : [children];
  const sections: DocJSXElementByFn<'Section'>[] =
    final.filter(x => isDocJSXElement(x) && x.type === c.Section && castTo<DocJSXElementByFn<'Section'>>(x).props.title !== 'Overview');
  return <ol>
    {...sections.map(item => <li><c.Anchor title={item.props.title} href={item.props.title} /></li>)}
  </ol>;
}

export const text = async () => {
  const startupOutput = await init();
  const key = Util.uuid(80);
  let root: DocJSXElement;
  return root = <>
    <c.Header title='Getting Started: A Todo App' />

    The following tutorial wil walk you through setting up a {d.library('Travetto')} application from scratch.  We'll be building a simple todo application. The entire source of the finished project can be found at {TodoRoot}.  Additionally, you can use the {d.module('Scaffold')}.

    <c.Section title='Overview'>
      <TableOfContents root={() => root} />
    </c.Section>

    <c.Section title='Prerequisites'>

      Install
      <ul>
        <li>{d.library('NodeDownload')} v24.x+ (required)</li>
        <li>{d.library('MongoDownload')} 8.0+ (required)</li>
        <li>{d.library('VSCodeDownload')} (recommended)</li>
        <li>{d.library('TravettoPlugin')} (recommended)</li>
      </ul>
    </c.Section>
    <c.Section title='Project Initialization'>

      <c.Terminal title='Getting Ready' src={`
$ mkdir todo-project
$ cd todo-project

$ git init .

$ ${PackageDocUtil.getWorkspaceInitCommand()}
$ ${PackageDocUtil.getInstallCommand('@travetto/{log,web-http,model-mongo,cli}', true)}
$ ${PackageDocUtil.getInstallCommand('@travetto/{eslint,compiler,test}')}

$ ${d.trv} eslint:register
`} />
    </c.Section>
    <c.Section title='Establishing The Model'>

      Let's create the model for the todo application.  The fields we will need should be:

      <ul>
        <li>{d.field('id')} as a unique identifier</li>
        <li>{d.field('text')} as the actual todo information</li>
        <li>{d.field('created')} the date the todo was created</li>
        <li>{d.field('completed')} whether or not the todo was completed</li>
      </ul>

      Create the file {d.path('src/model.ts')}

      <c.Code title='Models' src='src/model.ts' />

      as you can see, the model structure is simple.  Everything that uses the {Model} services needs to implement {toConcrete<ModelType>()}.
    </c.Section>

    <c.Section title='Building the Service Layer'>

      Next we establish the functionality for the service layer. The operations we need are:
      <ul>
        <li>Create a new todo</li>
        <li>Complete a todo</li>
        <li>Remove a todo</li>
        <li>Get all todos</li>
      </ul>

      Now we need to create {d.path('src/service.ts')}

      <c.Code title='Service Definition' src='src/service.ts' />
    </c.Section>

    <c.Section title='Writing Unit tests' >

      After we have established our service layer, we will now construct some simple tests to verify the service layer is running correctly. By default we set the database schema name under {d.path('test/resources/application.yml')} to ensure we aren't writing to our dev database.

      <c.Code title='Test YAML' src='resources/test.yml' />

      Now the tests should be defined at {d.path('test/service.ts')}

      <c.Code title='Test bed' src='test/service.ts' />
    </c.Section>

    <c.Section title='Adding Web Endpoints'>
      Now we establish the endpoints, providing an interface to the service layer.<br />

      Finally, we establish the controller at {d.path('src/web.ts')}

      <c.Code title='Controller contents' src='src/web.ts' />
    </c.Section>

    <c.Section title='Running the App'>

      First we must start the application:

      <c.Terminal
        title='Start the Application' src={`${d.trv} web:http`}
      />

      <c.Terminal title='Application Startup' src={startupOutput} />

      next, let's execute {d.library('Fetch')} requests to interact with the new api. <br />

      Create {d.path('support/create-todo.ts')} with the following contents:

      <c.Code title='Creating Todo by fetch' src='doc/create-todo.ts' />

      <c.Execution
        title='Create Output' cmd='trv' args={['main', 'doc/create-todo.ts', key, `${port}`]}
        config={{
          rewrite: line => line.replaceAll(key, '<key>').replace(/[0-9a-f]{32}/, '<uniqueId>'),
          formatCommand: (name, args) => [name, ...args].map(arg =>
            arg.replaceAll('doc/create', 'support/create').replace(key, '<key>').replace(new RegExp(`${port}`, 'g'), '<port>')
          ).join(' ')
        }}
      />

      Now create {d.path('support/list-todo.ts')} with the following contents:

      <c.Code title='Listing Todos by fetch' src='doc/list-todo.ts' />

      <c.Execution title='Listing Output' cmd='trv' args={['main', 'doc/list-todo.ts', key, `${port}`]} config={{
        rewrite: line => line.replaceAll(key, '<key>').replace(/[0-9a-f]{32}/, '<uniqueId>'),
        formatCommand: (name, args) => [name, ...args].map(
          arg => arg.replaceAll('doc/list', 'support/list').replace(key, '<key>').replace(new RegExp(`${port}`, 'g'), '<port>')
        ).join(' ')
      }} />
    </c.Section>
  </>;
};