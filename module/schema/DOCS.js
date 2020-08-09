const { doc: d, Section, SubSection, List, inp, lib, Code, Execute, Note, Snippet, Mod, meth, Config } = require('@travetto/doc');
const {
  Field, Required, Enum, Trimmed, Match, MinLength, MaxLength,
  Min, Max, Email, Telephone, Url, Ignore, Integer, Float, Currency, LongText, Text
} = require('./src/decorator/field');
const { Schema } = require('./src/decorator/schema');
const { Describe } = require('./src/decorator/common');
const { SchemaBody, SchemaQuery } = require('./src/extension/rest');

exports.text = d`
This module provide a mechanisms for registering classes and field level information as well the ability to apply that information at runtime.

${Section('Registration')}
The registry's schema information is defined by ${lib.Typescript} AST and only applies to classes registered with the ${Schema} decoration. 

${SubSection('Classes')}
The module utilizes AST transformations to collect schema information, and facilitate the registration process without user intervention. The class can also be described using providing a:

${List(
  d`${inp`title`} - definition of the schema`,
  d`${inp`description`} - detailed description of the schema`,
  d`${inp`examples`} - A set of examples as ${lib.JSON} or ${lib.YAML}`,
)}

The ${inp`title`} will be picked up from the ${lib.JSDoc} comments, and additionally all fields can be set using the ${Describe} decorator.

${Code('Sample User Schema', 'alt/docs/src/user.ts')}

From this schema, the registry would have the following information:

${Config('User schemas as a YAML file', 'alt/docs/resources/user.yml')}


${SubSection('Fields')}
This schema provides a powerful base for data binding and validation at runtime.  Additionally there may be types that cannot be detected, or some information that the programmer would like to override. Below are the supported field decorators:

${List(
  d`${Field} defines a field that will be serialized.`,
  d`${Required} defines a that field should be required`,
  d`${Enum} defines the allowable values that a field can have`,
  d`${Trimmed} augments binding to remove leading and trailing whitespace from string values`,
  d`${Match} defines a regular expression that the field value should match`,
  d`${MinLength} enforces min length of a string`,
  d`${MaxLength} enforces max length of a string`,
  d`${Min} enforces min value for a date or a number`,
  d`${Max} enforces max value for a date or a number`,
  d`${Email} ensures string field matches basic email regex`,
  d`${Telephone} ensures string field matches basic telephone regex`,
  d`${Url} ensures string field matches basic url regex`,
  d`${Ignore} exclude from auto schema registration`,
  d`${Integer} ensures number passed in is only a whole number`,
  d`${Float} ensures number passed in allows fractional values`,
  d`${Currency} provides support for standard currency`,
  d`${Text} indicates that a field is expecting natural language input, not just discrete values`,
  d`${LongText} same as text, but expects longer form content`,
)}

Additionally, schemas can be nested to form more complex data structures that are able to bound and validated.

Just like the class, all fields can be defined with

${List(
  d`${inp`description`} - detailed description of the schema`,
  d`${inp`examples`} - A set of examples as ${lib.JSON} or ${lib.YAML}`
)}

And similarly, the ${inp`description`} will be picked up from the ${lib.JSDoc} comments, and additionally all fields can be set using the ${Describe} decorator.

${Section('Binding/Validation')}
At runtime, once a schema is registered, a programmer can utilize this structure to perform specific operations. Specifically binding and validation.

${SubSection('Binding')}
Binding is a very simple operation, as it takes in a class registered as as ${Schema} and a JS object that will be the source of the binding. Given the schema:

${Code('Sub Schemas via Address', 'alt/docs/src/person.ts')}

A binding operation could look like:

${Code('Binding from JSON to Schema', 'alt/docs/src/person-binding.ts')}

and the output would be a ${inp`Person`} instance with the following structure

${Execute('Sample data output after binding', 'alt/docs/src/person-output.js')}

${Note(`Binding will attempt to convert/coerce types as much as possible to honor the pattern of Javascript and it's dynamic nature.`)}

${SubSection('Validation')}

Validation is very similar to binding, but instead of attempting to assign values, any mismatch or violation of the schema will result in errors. All errors will be collected and returned. Given the same schema as above,

${Code('Sub Schemas via Address', 'alt/docs/src/person.ts')}

But now with an invalid json object

${Code('Read Person, and validate', 'alt/docs/src/person-binding-invalid.ts')}

would produce an exception similar to following structure

${Execute('Sample error output', 'alt/docs/src/person-invalid-output.js')}

${SubSection('Custom Validators')}

Within the schema framework, it is possible to add custom validators class level.  This allows for more flexibility when dealing with specific situations (e.g. password requirements or ensuring two fields match)

${Code('Password Validator', 'alt/docs/src/password-validator.ts')}

When the validator is executed, it has access to the entire object, and you can check any of the values.  The validator expects an object of a specific structure if you are looking to indicate an error has occurred.

${Snippet('Validation Error Structure', './src/validate/types.ts', /interface ValidationError/, /^\}/)}

${Section('Extension - Rest')}

The module provides high level access for ${Mod('rest')} support, via decorators, for validating and typing request bodies.

${SchemaBody} provides the ability to convert the inbound request body into a schema bound object, and provide validation before the controller even receives the request.

${Code(d`Using ${SchemaBody.name} for POST requests`, 'alt/docs/src/schema-body.ts')}

${SchemaQuery} provides the ability to convert the inbound request query into a schema bound object, and provide validation before the controller even receives the request.

${Code(d`Using ${SchemaQuery.name} for GET requests`, 'alt/docs/src/schema-query.ts')}

Addtionally, ${SchemaQuery} and ${SchemaBody} can also be used with ${inp`interface`}s and ${inp`type`} literals in lieu of classes. This is best suited for simple types:

${Code(d`Using ${SchemaQuery.name} with a type literal`, 'alt/docs/src/schema-query-type.ts')}


${Section('Extension - Generation')}
In the course of application development, there is often a need to generate fake data on demand. Given all the information that we have about the schemas provided, translating that into data generation is fairly straightforward.  The generation utility is built upon ${lib.Faker}, mapping data types, and various field names into specific ${lib.Faker} generation routines.

By default all types are mapped as-is:

${List(
  d`${inp`string`}`,
  d`${inp`number`}`,
  d`${inp`Date`}`,
  d`${inp`boolean`}`,
  d`Enumerations as ${inp`string`} or ${inp`number`} types.`,
  d`Provided regular expressions: ${List(
    'email',
    'url',
    'telephone',
    'postalCode',
  )}`,
  d`Sub-schemas as registered via ${Schema} decorators.`
)}

In addition to the general types, the code relies upon name matching to provide additional refinement:

${Snippet('Supported Mappings', './src/extension/faker.ts', /NAMES_TO_TYPE/, /\};/)}

An example of this would be:

${Code('More complex Schema, used with Faker', 'alt/docs/src/faker.ts')}

${Section('Custom Types')}
When working with the schema, the basic types are easily understood, but some of ${lib.Typescript}'s more complex constructs are too complex to automate cleanly.

To that end, the module supports two concepts:

${SubSection('Type Adapters')}
This feature is meant to allow for simple Typescript types to be able to be backed by a proper class.  This is because all of the typescript type information disappears at runtime, and so only concrete types (like classes) remain.  An example of this, can be found with how the ${Mod('model')} module handles geo data.

${Code('Simple Custom Type', 'alt/docs/src/custom-type.ts')}

What you can see here is that the ${inp`Point`} type is now backed by a class that supports:

${List(
  d`${meth`validateSchema`} - Will run during validation for this specific type.`,
  d`${meth`bindSchema`} - Will run during binding to ensure correct behavior.`,
)}

${Code('Simple Custom Type Usage', 'alt/docs/src/custom-type-usage.ts')}

All that happens now, is the type is exported, and the class above is able to properly handle point as an ${inp`[x, y]`} tuple.  All standard binding and validation patterns are supported, and type enforcement will work as expected.

${Execute('Custom Type Validation', 'alt/docs/src/custom-type-output.js')};
`;