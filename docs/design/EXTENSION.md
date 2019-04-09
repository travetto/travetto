# Extensions

Making code extensible can be challenging due to the nature of multiple points of connectivity, and the explosion of combinations.

To that end, travetto allows for extensions by using certain patterns to denote optional code that can gracefully fail to import.  This means that most extensions should not export, but be self contained.  Usually this is general wiring/plumbing that allows for connecting various modules together (e.g. auth-rest and rest-session). 

The way this works is that the code scanning will automatically attempt to require extensions at startup, and gracefully ignore them if the the required modules are not
installed.  This allows for automatic connections to be established by installing compatible modules, without the need for explicit configuration.

* The AST transformers will bypass an import to an extension if the required module is not found.
* The module manager will force extensions to fail to load in watch mode, in lieu of creating a failed proxy.  This is to prevent unexpected behavior of extensions failing at runtime.
* The compiler's require handler will catch the failed load, and indicate that extension loading was ignored, and leave it at that

Again, to gracefully allow for auto-loading, the modules should not export or be directly imported.  There are some exceptions (e.g. schema/faker), but in general the extensions are meant to be transparent.