/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

import {
  Currency, Email, Enum, Field, Float, Ignore, Integer,
  LongText, Match, Max, MaxLength, Min, MinLength, Readonly,
  Required, Telephone, Url, Writeonly, Text, Secret, Specifier,
  SubTypeField
} from './src/decorator/field';

import { Schema } from './src/decorator/schema';
import { Describe } from './src/decorator/common';

export const text = <>
  <c.StdHeader />

  This module's purpose is to allow for proper declaration and validation of data types, in the course of running a program.  The framework defined here, is
  leveraged in the {d.mod('Config')}, {d.mod('Cli')}, {d.mod('Rest')}, {d.mod('Openapi')} and {d.mod('Model')} modules.  The schema is the backbone of all data transfer, as it helps to
  provide validation on correctness of input, whether it is a rest request, command line inputs, or a configuration file. <br />

  This module provides a mechanism for registering classes and field level information as well the ability to apply that information at runtime.

  <c.Section title='Registration'>
    The registry's schema information is defined by {d.library('Typescript')} AST and only applies to classes registered with the {Schema} decoration.

    <c.SubSection title='Classes' >
      The module utilizes AST transformations to collect schema information, and facilitate the registration process without user intervention. The class can also be described using providing a:

      <ul>
        <li>{d.input('title')} - definition of the schema</li>
        <li>{d.input('description')} - detailed description of the schema</li>
        <li>{d.input('examples')} - A set of examples as {d.library('JSON')} or {d.library('YAML')}</li>
      </ul>

      The {d.input('title')} will be picked up from the {d.library('JSDoc')} comments, and additionally all fields can be set using the {Describe} decorator.

      <c.Code title='Sample User Schema' src='doc/user.ts' />

      From this schema, the registry would have the following information:

      <c.Config title='User schemas as a YAML file' src='doc/user.yml' />
    </c.SubSection>

    <c.SubSection title='Fields'>
      This schema provides a powerful base for data binding and validation at runtime.  Additionally there may be types that cannot be detected, or some information that the programmer would like to override. Below are the supported field decorators:

      <ul>
        <li>{Field} defines a field that will be serialized.</li>
        <li>{Required} defines a that field should be required</li>
        <li>{Enum} defines the allowable values that a field can have</li>
        <li>{Match} defines a regular expression that the field value should match</li>
        <li>{MinLength} enforces min length of a string</li>
        <li>{MaxLength} enforces max length of a string</li>
        <li>{Min} enforces min value for a date or a number</li>
        <li>{Max} enforces max value for a date or a number</li>
        <li>{Email} ensures string field matches basic email regex</li>
        <li>{Telephone} ensures string field matches basic telephone regex</li>
        <li>{Url} ensures string field matches basic url regex</li>
        <li>{Ignore} exclude from auto schema registration</li>
        <li>{Integer} ensures number passed in is only a whole number</li>
        <li>{Float} ensures number passed in allows fractional values</li>
        <li>{Currency} provides support for standard currency</li>
        <li>{Text} indicates that a field is expecting natural language input, not just discrete values</li>
        <li>{LongText} same as text, but expects longer form content</li>
        <li>{Readonly} defines a that field should not be bindable external to the class</li>
        <li>{Writeonly} defines a that field should not be exported in serialization, but that it can be bound to</li>
        <li>{Secret} marks a field as being sensitive.  This is used by certain logging activities to ensure sensitive information is not logged out.</li>
        <li>{Specifier} attributes additional specifiers to a field, allowing for more specification beyond just the field's type.</li>
        <li>{SubTypeField} allows for promoting a given field as the owner of the sub type discriminator (defaults to {d.field('type')}).</li>
      </ul>

      Additionally, schemas can be nested to form more complex data structures that are able to bound and validated. <br />

      Just like the class, all fields can be defined with

      <ul>
        <li>{d.input('description')} - detailed description of the schema</li>
        <li>{d.input('examples')} - A set of examples as {d.library('JSON')} or {d.library('YAML')}</li>
      </ul>

      And similarly, the {d.input('description')} will be picked up from the {d.library('JSDoc')} comments, and additionally all fields can be set using the {Describe} decorator.
    </c.SubSection>
    <c.SubSection title='Parameters'>
      Parameters are available in certain scenarios (e.g. {d.mod('Rest')} endpoints and {d.mod('Cli')} main methods).  In these scenarios, all of the field decorators are valid, but need to be called slightly differently to pass the typechecker. The simple solution is to use the {d.field('Arg')} field of the decorator to convince Typescript its the correct type.

      <c.Code title='Sample Parameter Usage' src='doc/param-usage.ts'></c.Code>
    </c.SubSection>
  </c.Section>

  <c.Section title='Binding/Validation'>
    At runtime, once a schema is registered, a programmer can utilize this structure to perform specific operations. Specifically binding and validation.

    <c.SubSection title='Binding'>
      Binding is a very simple operation, as it takes in a class registered as as {Schema} and a JS object that will be the source of the binding. Given the schema:

      <c.Code title='Sub Schemas via Address' src='doc/person.ts' />

      A binding operation could look like:

      <c.Code title='Binding from JSON to Schema' src='doc/person-binding.ts' />

      and the output would be a {d.input('Person')} instance with the following structure

      <c.Execution title='Sample data output after binding' cmd='trv' args={['main', 'doc/person-output.ts']} />

      <c.Note>Binding will attempt to convert/coerce types as much as possible to honor the pattern of Javascript and it's dynamic nature.</c.Note>
    </c.SubSection>

    <c.SubSection title='Validation'>
      Validation is very similar to binding, but instead of attempting to assign values, any mismatch or violation of the schema will result in errors. All errors will be collected and returned. Given the same schema as above,

      <c.Code title='Sub Schemas via Address' src='doc/person.ts' />

      But now with an invalid json object

      <c.Code title='Read Person, and validate' src='doc/person-binding-invalid.ts' />

      would produce an exception similar to following structure

      <c.Execution title='Sample error output' cmd='trv' args={['main', 'doc/person-invalid-output.ts']} />
    </c.SubSection>

    <c.SubSection title='Custom Validators'>
      Within the schema framework, it is possible to add custom validators class level.  This allows for more flexibility when dealing with specific situations (e.g. password requirements or ensuring two fields match)

      <c.Code title='Password Validator' src='doc/password-validator.ts' />

      When the validator is executed, it has access to the entire object, and you can check any of the values.  The validator expects an object of a specific structure if you are looking to indicate an error has occurred.

      <c.Code title='Validation Error Structure' src='src/validate/types.ts' startRe={/interface ValidationError/} endRe={/^\}/} />
    </c.SubSection>
  </c.Section>

  <c.Section title='Custom Types'>
    When working with the schema, the basic types are easily understood, but some of {d.library('Typescript')}'s more complex constructs are too complex to automate cleanly. <br />

    To that end, the module supports two concepts:

    <c.SubSection title='Type Adapters'>
      This feature is meant to allow for simple Typescript types to be able to be backed by a proper class.  This is because all of the typescript type information disappears at runtime, and so only concrete types (like classes) remain.  An example of this, can be found with how the {d.mod('ModelQuery')} module handles geo data.

      <c.Code title='Simple Custom Type' src='doc/custom-type.ts' />

      What you can see here is that the {d.input('Point')} type is now backed by a class that supports:

      <ul>
        <li>{d.method('validateSchema')} - Will run during validation for this specific type.</li>
        <li>{d.method('bindSchema')} - Will run during binding to ensure correct behavior.</li>
      </ul>

      <c.Code title='Simple Custom Type Usage' src='doc/custom-type-usage.ts' />

      All that happens now, is the type is exported, and the class above is able to properly handle point as an {d.input('[x, y]')} tuple.  All standard binding and validation patterns are supported, and type enforcement will work as expected.

      <c.Execution title='Custom Type Validation' cmd='trv' args={['main', 'doc/custom-type-output.ts']} />
    </c.SubSection>
  </c.Section>
</>;