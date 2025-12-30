/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { Todo } from './doc/model.ts';

export const text = <>
  <c.StdHeader install={false} />

  A simple tool for scaffolding a reference project.  To get started, you need to make sure:

  <c.Terminal title='Setting up the necessary config' src={`
$ git config --global.username <Username> #Set your git username
`} />

  Once the necessary configuration is setup, you can invoke the scaffolding by running

  <c.Terminal title='Running Generator' src={`
$ npx @travetto/scaffold

# or

$ npx @travetto/scaffold@<version-or-tag>

`} />

  The generator will ask about enabling the following features:

  <c.Section title='Web Application'>
    The {d.mod('Web')} provides the necessary integration for exposing web apis.  When selecting the {d.input('web')} feature, you will need to specify which backend you want to include with your application, the default being {d.library('Express')}.  Currently you can select from:

    <ul>
      <li>{d.library('Express')}</li>
      <li>{d.library('Koa')}</li>
      <li>{d.library('Fastify')}</li>
    </ul>

    The code will establish some basic endpoints, specifically, {d.input('GET / ')} as the root endpoint.  This will return the contents of your {d.path('package.json')} as an identification operation.

    <c.SubSection title='Additional Web Features'>
      In addition to the core functionality, the {d.input('web')} feature has some useful sub-features.  Specifically:<br />

      {d.mod('Openapi')} support for the web api.  This will automatically expose a {d.path('openapi.yml')} endpoint, and provide the necessary plumbing to support client generation. <br />

      {d.mod('Log')} support for better formatting, {d.library('Debug')} like support, and colorized output.  This is generally useful for server logs, especially during development.
    </c.SubSection>
  </c.Section>

  <c.Section title='Authentication'>
    Authentication is also supported on the Web endpoints by selecting {d.mod('AuthWeb')} during setup.  This will support basic authentication running out of local memory.
  </c.Section>

  <c.Section title='Testing'>
    {d.mod('Test')} can also be configured out of the box to provide simple test cases for the data model.
  </c.Section>

  <c.Section title='Data Modelling and Storage'>

    The {d.mod('Model')} allows for modeling of application data, and provides mechanisms for storage and retrieval.  When setting up your application, you will need to select which database backend you want to use:

    <ul>
      <li>{d.library('Elasticsearch')}</li>
      <li>{d.library('MongoDB')}</li>
      <li>{d.library('SQL')}</li>
      <li>{d.library('DynamoDB')}</li>
      <li>{d.library('Firestore')}</li>
    </ul>

    A default model is constructed, a {Todo} class:

    <c.Code title='Todo Model' src={Todo} startRe={/./} />

    Basic tests are also included for the {d.input('model')} to verify that database interaction and functionality is working properly.
  </c.Section>

  <c.Section title='Web + Model'>
    In the case both {d.input('web')} and {d.input('model')} features are enabled, the code will produce a controller that exposes the {Todo} model via web patterns.

    <c.Code title='Todo controller' src='./doc/controller.ts' />
  </c.Section>

  <c.Section title='Running'>

    Once finished the application will reflect the modules chosen, and will be ready for execution, if you have configured a runnable application.  Currently, this requires the {d.input('web')} feature to be selected.

    <c.Terminal title='Starting the App' src='npm start' />
  </c.Section>
</>;