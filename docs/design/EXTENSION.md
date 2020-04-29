# Extensions

Making code extensible can be challenging due to the nature of multiple points of connectivity, and the explosion of combinations.

To that end, travetto allows for extensions by using certain patterns to denote optional code that can gracefully fail to import. The way this is achieved, is by using the file level macro, `// @file-if <module>`.  When this directive is in a file, the file will have it's contents replaced with an error proxy, if that module is not available.  Assuming that module is not accessed, no errors should occur, and everything should work as appropriately.  If accessed, the proxy will throw an error indicating the module needs to be installed.