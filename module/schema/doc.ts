import { d, lib, mod } from '@travetto/doc';

import {
  Field, Required, Enum, Trimmed, Match, MinLength, MaxLength,
  Min, Max, Email, Telephone, Url, Ignore, Integer, Float, Currency, LongText, Text, Readonly, Writeonly
} from './src/decorator/field';
import { Schema } from './src/decorator/schema';
import { Describe } from './src/decorator/common';

export const text = d`
${d.Header()}

This module's purpose is to allow for proper declaration and validation of data types, in the course of running a program.  The framework defined here, is 
leveraged in the ${mod.Config}, ${mod.App}, ${mod.Rest}, ${mod.Openapi} and ${mod.Model} modules.  The schema is the backbone of all data transfer, as it helps to
provide validation on correctness of input, whether it is a rest request, command line inputs, or a configuration file.

This module provides a mechanism for registering classes and field level information as well the ability to apply that information at runtime.

${d.Section('Registration')}
The registry's schema information is defined by ${lib.Typescript} AST and only applies to classes registered with the ${Schema} decoration. 

${d.SubSection('Classes')}
The module utilizes AST transformations to collect schema information, and facilitate the registration process without user intervention. The class can also be described using providing a:

${d.List(
  d`${d.Input('title')} - definition of the schema`,
  d`${d.Input('description')} - detailed description of the schema`,
  d`${d.Input('examples')} - A set of examples as ${lib.JSON} or ${lib.YAML}`,
)}

The ${d.Input('title')} will be picked up from the ${lib.JSDoc} comments, and additionally all fields can be set using the ${Describe} decorator.

${d.Code('Sample User Schema', 'doc/user.ts')}

From this schema, the registry would have the following information:

${d.Config('User schemas as a YAML file', 'doc/resources/user.yml')}


${d.SubSection('Fields')}
This schema provides a powerful base for data binding and validation at runtime.  Additionally there may be types that cannot be detected, or some information that the programmer would like to override. Below are the supported field decorators:

${d.List(
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
  d`${Readonly} defines a that field should not be bindable external to the class`,
  d`${Writeonly} defines a that field should not be exported in serialization, but that it can be bound to`,

)}

Additionally, schemas can be nested to form more complex data structures that are able to bound and validated.

Just like the class, all fields can be defined with

${d.List(
  d`${d.Input('description')} - detailed description of the schema`,
  d`${d.Input('examples')} - A set of examples as ${lib.JSON} or ${lib.YAML}`
)}

And similarly, the ${d.Input('description')} will be picked up from the ${lib.JSDoc} comments, and additionally all fields can be set using the ${Describe} decorator.

${d.Section('Binding/Validation')}
At runtime, once a schema is registered, a programmer can utilize this structure to perform specific operations. Specifically binding and validation.

${d.SubSection('Binding')}
Binding is a very simple operation, as it takes in a class registered as as ${Schema} and a JS object that will be the source of the binding. Given the schema:

${d.Code('Sub Schemas via Address', 'doc/person.ts')}

A binding operation could look like:

${d.Code('Binding from JSON to Schema', 'doc/person-binding.ts')}

and the output would be a ${d.Input('Person')} instance with the following structure

${d.Execute('Sample data output after binding', 'doc/person-output.ts')}

${d.Note("Binding will attempt to convert/coerce types as much as possible to honor the pattern of Javascript and it's dynamic nature.")}

${d.SubSection('Validation')}

Validation is very similar to binding, but instead of attempting to assign values, any mismatch or violation of the schema will result in errors. All errors will be collected and returned. Given the same schema as above,

${d.Code('Sub Schemas via Address', 'doc/person.ts')}

But now with an invalid json object

${d.Code('Read Person, and validate', 'doc/person-binding-invalid.ts')}

would produce an exception similar to following structure

${d.Execute('Sample error output', 'doc/person-invalid-output.ts')}

${d.SubSection('Custom Validators')}

Within the schema framework, it is possible to add custom validators class level.  This allows for more flexibility when dealing with specific situations (e.g. password requirements or ensuring two fields match)

${d.Code('Password Validator', 'doc/password-validator.ts')}

When the validator is executed, it has access to the entire object, and you can check any of the values.  The validator expects an object of a specific structure if you are looking to indicate an error has occurred.

${d.Snippet('Validation Error Structure', 'src/validate/types.ts', /interface ValidationError/, /^\}/)}

${d.Section('Extension - Generation')}
In the course of application development, there is often a need to generate fake data on demand. Given all the information that we have about the schemas provided, translating that into data generation is fairly straightforward.  The generation utility is built upon ${lib.Faker}, mapping data types, and various field names into specific ${lib.Faker} generation routines.

By default all types are mapped as-is:

${d.List(
  d`${d.Input('string')}`,
  d`${d.Input('number')}`,
  d`${d.Input('Date')}`,
  d`${d.Input('boolean')}`,
  d`Enumerations as ${d.Input('string')} or ${d.Input('number')} types.`,
  d`Provided regular expressions: ${d.List(
    'email',
    'url',
    'telephone',
    'postalCode',
  )}`,
  d`Sub-schemas as registered via ${Schema} decorators.`
)}

In addition to the general types, the code relies upon name matching to provide additional refinement:

${d.Snippet('Supported Mappings', 'src/extension/faker.ts', /#namesToType/, /\};/)}

An example of this would be:

${d.Code('More complex Schema, used with Faker', 'doc/faker.ts')}

${d.Section('Custom Types')}
When working with the schema, the basic types are easily understood, but some of ${lib.Typescript}'s more complex constructs are too complex to automate cleanly.

To that end, the module supports two concepts:

${d.SubSection('Type Adapters')}
This feature is meant to allow for simple Typescript types to be able to be backed by a proper class.  This is because all of the typescript type information disappears at runtime, and so only concrete types (like classes) remain.  An example of this, can be found with how the ${mod.ModelQuery} module handles geo data.

${d.Code('Simple Custom Type', 'doc/custom-type.ts')}

What you can see here is that the ${d.Input('Point')} type is now backed by a class that supports:

${d.List(
  d`${d.Method('validateSchema')} - Will run during validation for this specific type.`,
  d`${d.Method('bindSchema')} - Will run during binding to ensure correct behavior.`,
)}

${d.Code('Simple Custom Type Usage', 'doc/custom-type-usage.ts')}

All that happens now, is the type is exported, and the class above is able to properly handle point as an ${d.Input('[x, y]')} tuple.  All standard binding and validation patterns are supported, and type enforcement will work as expected.

${d.Execute('Custom Type Validation', 'doc/custom-type-output.ts')};
`;