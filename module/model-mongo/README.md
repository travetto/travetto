travetto: Mongo
===

This module provides access to Mongo DB, and provides easy access to a mongodb instance.  It also 
supports saving/updating/deleting class instances, where the class instance is presumed to be the
name of the collection you want to store/retrieve data from .

It also supports convenience methods for bulk update/delete.

Another key feature is that it will automatically translate `_id` fields to and from `string` types to `ObjectId` 
without the developer needing to think about the state. 
