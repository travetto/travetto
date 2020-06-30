import { doc as d, inp, Ref, Section, Code, Note, SubSection, lib } from '@travetto/doc';
import { Injectable, InjectableFactory, Inject } from './src/decorator';
import { Config } from '@travetto/config';
import { $DependencyRegistry } from './src/registry';

export default d`
${lib.DependencyInjection} is a framework primitive.  When used in conjunction with automatic file scanning, it provides for handling of application dependency wiring. Due to the nature of ${lib.Typescript} and type erasure of interfaces, dependency injection only supports ${inp`class`}es as type signafiers. The primary goal of dependency injection is to allow for separation of concerns of object creation and it's usage.

${Section('Declaration')}
The ${Injectable} and ${InjectableFactory} decorators provide the registration of dependencies.   Dependency declaration revolves around exposing ${inp`class`}es and subtypes thereof to provide necessary functionality.  Additionally, the framework will utilize dependencies to satisfy contracts with various backends (e.g. ${Ref('MongoModelSource', '../model-mongo/src/source.ts')} provides itself as an injectable candidate for ${Ref('ModelSource', '../model/src/service/source.ts')}.

${Code(d`Example ${Injectable.name}`, 'alt/docs/src/injectable.ts')}

When declaring a dependency, you can also provide a token to allow for multiple instances of the dependency to be defined.  This can be used in many situations:

${Code(d`Example ${Injectable.name} with multiple targets`, 'alt/docs/src/injectable-multiple.ts')}


As you can see, the ${inp`target`} field is also set, which indicates to the dependency registration process what ${inp`class`} the injectable is compatible with.  Additionally, when using ${inp`abstract`} classes, the parent ${inp`class`} is always considered as a valid candidate type.

${Code(d`Example ${Injectable.name} with target via abstract class`, 'alt/docs/src/injectable-abstract.ts')}

In this scenario, ${inp`SpecificService`} is a valid candidate for ${inp`BaseService`} due to the abstract inheritance. Sometimes, you may want to provide a slight variation to  a dependency without extending a class.  To this end, the ${InjectableFactory} decorator denotes a ${inp`static`} class method that produces an ${Injectable}.


${Code(d`Example ${InjectableFactory.name}`, 'alt/docs/src/injectable-factory.ts')}


Given the ${inp`static`} method ${inp`initService`}, the function will be provided as a valid candidate for ${inp`CoolService`}.  Instead of calling the constructor of the type directly, this function will work as a factory for producing the injectable.

${Note(d`Other modules are able to provide aliases to ${Injectable} that also provide additional functionality.  For example, the ${Config} or the ${Ref('Controller', '../rest/src/decorator/controller.ts')} decorator registers the associated class as an injectable element.`)}


${Section('Injection')}

Once all of your necessary dependencies are defined, now is the time to provide those ${Injectable} instances to your code.  There are three primary methods for injection:

The ${Inject} decorator, which denotes a desire to inject a value directly.  These will be set post construction.

${Code(d`Example ${Injectable.name} with dependencies as ${Inject} fields`, 'alt/docs/src/injectable-fields.ts')}


The ${Injectable} constructor params, which will be provided as the instance is being constructed.

${Code(d`Example ${Injectable.name} with dependencies in constructor`, 'alt/docs/src/injectable-constructor.ts')}

Via ${InjectableFactory} params, which are comparable to constructor params

${Code(d`Example ${InjectableFactory.name} with parameters as dependencies`, 'alt/docs/src/injectable-factory-params.ts')}


${SubSection('Multiple Candidates for the Same Type')}

If you are building modules for others to consume, often times it is possible to end up with multiple implementations for the same class.  

${Code(d`Example Multiple Candiate Types`, 'alt/docs/src/injectable-multiple-default.ts')}

By default, if there is only one candidate without qualification, then that candidate will be used.  If multiple candidates are found, then the injection system will bail.  To overcome this the end user will need to specify which candidate type should be considered ${inp`primary`}:

${Code(d`Example Multiple Candiate Types`, 'alt/docs/src/injectable-multiple-primary.ts')}

${Section('Manual Invocation')}

Some times you will need to lookup a dependency dynamically, or you want to control the injection process at a more granular level. To achieve that you will need to directly access the ${Ref('DependencyRegistry', $DependencyRegistry.ᚕfile)}. The registry allows for requesting a dependency by class reference:

${Code(d`Example of Manual Lookup`, 'alt/docs/src/injectable-manual.ts')}
`;