travetto: Yaml
===

In the desire to provide a minimal footprint, the framework provides a very minimal YAML parser/serializer to handle standard configuration structure.  Additionally, if the yaml support is too minimal, simply installing [`js-yaml`](https://github.com/nodeca/js-yaml) will override the serialization/parsing behavior to `js-yaml`'s strict implementation.

[`YamlUtil`](./src/api.ts) is the main access point for this module, and will expose two method, `parse` and `serialize`.

