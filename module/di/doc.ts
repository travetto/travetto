import { d, lib } from '@travetto/doc';
import { Config } from '@travetto/config';

import { Injectable, InjectableFactory, Inject } from './src/decorator';
import { DependencyRegistry } from './src/registry';

export const text = d`
${d.Header()}

${lib.DependencyInjection} is a framework primitive.  When used in conjunction with automatic file scanning, it provides for handling of application dependency wiring. Due to the nature of ${lib.Typescript} and type erasure of interfaces, dependency injection only supports ${d.Input('class')}es as a type signifier. The primary goal of dependency injection is to allow for separation of concerns of object creation and it's usage.

${d.Section('Declaration')}
The ${Injectable} and ${InjectableFactory} decorators provide the registration of dependencies.   Dependency declaration revolves around exposing ${d.Input('class')}es and subtypes thereof to provide necessary functionality.  Additionally, the framework will utilize dependencies to satisfy contracts with various implementations (e.g. ${d.Ref('MongoModelService', '@travetto/model-mongo/src/service.ts')} provides itself as an injectable candidate for ${d.Ref('ModelCrudSupport', '@travetto/model/src/service/crud.ts')}.

${d.Code(d`Example ${Injectable.name}`, 'doc/injectable.ts')}

When declaring a dependency, you can also provide a token to allow for multiple instances of the dependency to be defined.  This can be used in many situations:

${d.Code(d`Example ${Injectable.name} with multiple targets`, 'doc/injectable-multiple.ts')}


As you can see, the ${d.Input('target')} field is also set, which indicates to the dependency registration process what ${d.Input('class')} the injectable is compatible with.  Additionally, when using ${d.Input('abstract')} classes, the parent ${d.Input('class')} is always considered as a valid candidate type.

${d.Code(d`Example ${Injectable.name} with target via abstract class`, 'doc/injectable-abstract.ts')}

In this scenario, ${d.Input('SpecificService')} is a valid candidate for ${d.Input('BaseService')} due to the abstract inheritance. Sometimes, you may want to provide a slight variation to  a dependency without extending a class.  To this end, the ${InjectableFactory} decorator denotes a ${d.Input('static')} class method that produces an ${Injectable}.


${d.Code(d`Example ${InjectableFactory.name}`, 'doc/injectable-factory.ts')}


Given the ${d.Input('static')} method ${d.Input('initService')}, the function will be provided as a valid candidate for ${d.Input('CoolService')}.  Instead of calling the constructor of the type directly, this function will work as a factory for producing the injectable.

${d.Note(d`Other modules are able to provide aliases to ${Injectable} that also provide additional functionality.  For example, the ${Config} or the ${d.Ref('Controller', '@travetto/rest/src/decorator/controller.ts')} decorator registers the associated class as an injectable element.`)}


${d.Section('Injection')}

Once all of your necessary dependencies are defined, now is the time to provide those ${Injectable} instances to your code.  There are three primary methods for injection:

The ${Inject} decorator, which denotes a desire to inject a value directly.  These will be set post construction.

${d.Code(d`Example ${Injectable.name} with dependencies as ${Inject} fields`, 'doc/injectable-fields.ts')}


The ${Injectable} constructor params, which will be provided as the instance is being constructed.

${d.Code(d`Example ${Injectable.name} with dependencies in constructor`, 'doc/injectable-constructor.ts')}

Via ${InjectableFactory} params, which are comparable to constructor params

${d.Code(d`Example ${InjectableFactory.name} with parameters as dependencies`, 'doc/injectable-factory-params.ts')}


${d.SubSection('Multiple Candidates for the Same Type')}

If you are building modules for others to consume, often times it is possible to end up with multiple implementations for the same class.  

${d.Code(d`Example Multiple Candidate Types`, 'doc/injectable-multiple-default.ts')}

By default, if there is only one candidate without qualification, then that candidate will be used.  If multiple candidates are found, then the injection system will bail.  To overcome this the end user will need to specify which candidate type should be considered ${d.Input('primary')}:

${d.Code(d`Example Multiple Candidate Types`, 'doc/injectable-multiple-primary.ts')}

${d.Section('Manual Invocation')}

Some times you will need to lookup a dependency dynamically, or you want to control the injection process at a more granular level. To achieve that you will need to directly access the ${d.Ref('DependencyRegistry', DependencyRegistry.constructor.Ⲑfile)}. The registry allows for requesting a dependency by class reference:

${d.Code(d`Example of Manual Lookup`, 'doc/injectable-manual.ts')}
`;