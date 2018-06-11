travetto: Asset
===

This module provides the framework for storing/retrieving assets. It also provides image management functionality using `GraphicsMagick` under the covers.  This allows you to retrieve images and provide different sizes, transformations, etc. when serving up them up. 

If `GraphicsMagick` is not installed, the framework will spin up a `docker` container to provide needed functionality.

The primary driver for the Asset framework is an `AssetSource` which needs to be implemented 
to provide code on how to read and write files.  

Primary implementations:

- `asset-mongo` provides the mongodb driver for file management
- `asset-s3` provides the S3 driver for file management
