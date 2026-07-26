# Travetto 2.2 Release Notes

> Release 2.2.0: 2022-07-25 -- Alignment

As the framework has been moving forward, there has been a drive and goal to align with the growing standards in the TS/JS community. The last version (2.1.0) and the current release, have been about removing technical debt, and aligning with the changing landscape. In this release, the fundamental shift has been towards: 

* Removing exceptions to Typescript strict mode, and relying on strict mode as the standard 
* Explicit typing of every method, which has had the side effect of changing some return types slightly. 
* Stricter linting rules to help enforce better practices (e.g. treating type casts as an anti-pattern) 
* Swapping out use of NodeJS.ReadableStream for stream.Readable. 
* Various dependency updates 
## Rest Body Parsing
Centralized rest body parsing to common, controlled code to help create a consistent experience.  Each framework is still responsible for compressing as the nuances of sending seem to be highly specific to each framework.

## Future Work
* ESM Support - Many dependencies are starting to move to ESM and this is starting to cause problems.  As soon as the loader proposal for ESM is finalized, this will be the next major release item.
* TC39 Decorators - The new decorator proposal hit Stage 3, and so this will point to a rewrite of all decorators within the framework, w/o any API changes.  This will have a dependency on Typescript moving in the right direction, but this looks to be a priority for TS4.9.  
* Heap Snap-shotting - A mechanism for bootstrapping startup overhead.  This would provide a boost to testing startup time, and allow for simplification of "unloading" code, that is primarily used for testing.
