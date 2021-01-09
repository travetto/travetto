const { doc: d, Section, SubSection, Ref, Mod, inp, List, Ordered, Code } = require('@travetto/doc');

const RootReg = Ref('RootRegistry', './src/service/root.ts');
const SchemaReg = Ref('SchemaRegistry', '../schema/src/service/registry.ts');
const MetadataReg = Ref('MetadataRegistry', './src/service/metadata.ts');
const DependencyReg = Ref('DependencyRegistry', '../di/src/registry.ts');

exports.text = d`
This module is the backbone for all "discovered" and "registered" behaviors within the framework. This is primarily used for building modules within the framework and not directly useful for application development.

${Section('Flows')}
Registration, within the framework flows throw two main use cases:

${SubSection('Initial Flows')}

The primary flow occurs on initialization of the application. At that point, the module will:

${Ordered(
  d`Initialize ${RootReg} and will automatically register/load all relevant files`,
  `As files are imported, decorators within the files will record various metadata relevant to the respective registries`,
  d`When all files are processed, the ${RootReg} is finished, and it will signal to anything waiting on registered data that its free to use it.`,
)}

This flow ensures all files are loaded and processed before application starts. A sample registry could like:

${Code('Sample Registry', 'doc/registry.ts')}

The registry is a ${MetadataReg} that similar to the ${SchemaReg} and the ${DependencyReg}.

${SubSection('Live Flow')}
At runtime, the registry is designed to listen for changes and to propagate the changes as necessary. In many cases the same file is handled by multiple registries.

As the ${Mod('compiler')} notifies that a file has been changed and recompiled, the ${RootReg} will pick it up, and process it accordingly.

${Section('Supporting Metadata')}

For the registries to work properly, metadata needs to be collected about files and classes to uniquely identify them, especially across file reloads for the live flow.  To achieve this, every ${inp`class`} is decorated with additional fields.  The data that is added is:

${List(
  d`${inp`ᚕfile`} denotes the fully qualified path name of the class`,
  d`${inp`ᚕid`} represents a computed id that is tied to the file/class combination`
)};
`;