travetto: Asset
===

This module provides the framework for storing/retrieving assets. It also provides image management functionality using GraphicsMagick under the covers.  This allows you to retrieve images and provide different sizes, transformations, etc. when serving up them up. 

The primary driver for the Asset framework is an AssetSource which needs to be implemented 
to provide code on how to read and write files.  

`asset-mongo` provides the mongodb driver for file management

