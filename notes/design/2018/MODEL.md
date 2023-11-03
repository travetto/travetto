# Model and Model Source Relationship

The `Model` module defines two specific contracts:
* `ModelSource`
* `ModelService`

`ModelSource` is the provider relationship that implements the underlying query/storage operations.
`ModelService` is a higher-level abstraction that utilizes a `ModelSource`, but handles some of the boilerplate work.

## TODO: More context