/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { DependencyRegistryIndex, Injectable, InjectableFactory, Inject } from '@travetto/di';

export const text = <>
  <c.StdHeader />
  {d.library('DependencyInjection')} is a framework primitive.  When used in conjunction with automatic file scanning, it provides for handling of application dependency wiring. Due to the nature of {d.library('Typescript')} and type erasure of interfaces, dependency injection only supports {d.input('class')}es as a type signifier. The primary goal of dependency injection is to allow for separation of concerns of object creation and it's usage.

  <c.Section title='Declaration'>
    The {Injectable} and {InjectableFactory} decorators provide the registration of dependencies.   Dependency declaration revolves around exposing {d.input('class')}es and subtypes thereof to provide necessary functionality.  Additionally, the framework will utilize dependencies to satisfy contracts with various implementation.

    <c.Code title='Example Injectable' src='doc/injectable.ts' />

    When declaring a dependency, you can also provide a token to allow for multiple instances of the dependency to be defined.  This can be used in many situations:

    <c.Code title='Example Injectable with multiple targets' src='doc/injectable-multiple.ts' />

    As you can see, the {d.input('target')} field is also set, which indicates to the dependency registration process what {d.input('class')} the injectable is compatible with.  Additionally, when using {d.input('abstract')} classes, the parent {d.input('class')} is always considered as a valid candidate type.

    <c.Code title='Example Injectable with target via abstract class' src='doc/injectable-abstract.ts' />

    In this scenario, {d.input('SpecificService')} is a valid candidate for {d.input('BaseService')} due to the abstract inheritance. Sometimes, you may want to provide a slight variation to  a dependency without extending a class.  To this end, the {InjectableFactory} decorator denotes a {d.input('static')} class method that produces an {Injectable}.

    <c.Code title='Example InjectableFactory' src='doc/injectable-factory.ts' />

    Given the {d.input('static')} method {d.input('initService')}, the function will be provided as a valid candidate for {d.input('CoolService')}.  Instead of calling the constructor of the type directly, this function will work as a factory for producing the injectable.

    <c.Code title='Example Conditional Dependency' src='doc/injectable-conditional.ts' />

    In this example, the enabled flag is specified in relationship to the deployment environment.  When coupled with optional properties, and optional chaining, allows for seamless inclusion of optional dependencies at runtime.

    <c.Note>
      Other modules are able to provide aliases to {Injectable} that also provide additional functionality.  For example, the {d.mod('Config')} module @Config or the {d.mod('Web')} module @Controller decorator registers the associated class as an injectable element.
    </c.Note>
  </c.Section>

  <c.Section title='Injection' >

    Once all of your necessary dependencies are defined, now is the time to provide those {Injectable} instances to your code.  There are three primary methods for injection: <br />

    The {Inject} decorator, which denotes a desire to inject a value directly.  These will be set post construction. <br />

    <c.Code title='Example Injectable with dependencies as Inject fields' src='doc/injectable-fields.ts' />

    The {Injectable} constructor params, which will be provided as the instance is being constructed.

    <c.Code title='Example Injectable with dependencies in constructor' src='doc/injectable-constructor.ts' />

    Via {InjectableFactory} params, which are comparable to constructor params

    <c.Code title='Example InjectableFactory with parameters as dependencies' src='doc/injectable-factory-params.ts' />

    <c.SubSection title='Multiple Candidates for the Same Type'>

      If you are building modules for others to consume, often times it is possible to end up with multiple implementations for the same class.

      <c.Code title='Example Multiple Candidate Types' src='doc/injectable-multiple-default.ts' />

      By default, if there is only one candidate without qualification, then that candidate will be used.  If multiple candidates are found, then the injection system will bail.  To overcome this the end user will need to specify which candidate type should be considered {d.input('primary')}:

      <c.Code title='Example Multiple Candidate Types' src='doc/injectable-multiple-primary.ts' />
    </c.SubSection>
  </c.Section>

  <c.Section title='Non-Framework Dependencies'>
    The module is built around the framework's management of class registration, and being able to decorate the code with {Injectable} decorators. There may also be a desire to leverage external code and pull it into the dependency injection framework.  This could easily be achieved using a wrapper class that is owned by the framework. <br />

    It is also possible to directly reference external types, and they will be converted into unique symbols.  These symbols cannot be used manually, but can be leveraged using {Inject} decorators.

    <c.Code title='Example External Dependencies' src='./doc/injectable-foreign.ts' />
  </c.Section>

  <c.Section title='Manual Invocation'>

    Some times you will need to lookup a dependency dynamically, or you want to control the injection process at a more granular level. To achieve that you will need to directly access the {DependencyRegistryIndex}. The registry allows for requesting a dependency by class reference:

    <c.Code title='Example of Manual Lookup' src='doc/injectable-manual.ts' />

    Additionally, support for interfaces (over class inheritance) is provided, but requires binding the interface to a concrete class as the interface does not exist at runtime.

    <c.Code title='Example Interface Injection' src='doc/injectable-interface.ts' />
  </c.Section>
</>;