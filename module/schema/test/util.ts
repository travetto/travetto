import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { SchemaUtil } from '@travetto/schema';
import { BeforeAll, Suite, Test } from '@travetto/test';

import { Address } from './models/address.ts';
import { Count, Person, SuperAddress } from './models/binding.ts';

class UnregisteredClass {
  name: string;
}

@Suite('Schema Utilities')
class SchemaUtilTests {
  @BeforeAll()
  async initializeRegistry() {
    await Registry.init();
  }

  @Test('Verify root-level field config resolution')
  testRootField() {
    const nameConfiguration = SchemaUtil.getFieldConfig(Person, 'name');
    assert(nameConfiguration !== undefined);
    assert(nameConfiguration.type === String);

    const ageConfiguration = SchemaUtil.getFieldConfig(Person, 'age');
    assert(ageConfiguration !== undefined);
    assert(ageConfiguration.type === Number);

    const dateOfBirthConfiguration = SchemaUtil.getFieldConfig(Person, 'dob');
    assert(dateOfBirthConfiguration !== undefined);
    assert(dateOfBirthConfiguration.type === Date);
  }

  @Test('Verify nested dotted field config resolution')
  testNestedField() {
    const streetConfiguration = SchemaUtil.getFieldConfig(Person, 'address.street1');
    assert(streetConfiguration !== undefined);
    assert(streetConfiguration.type === String);
    assert(streetConfiguration.required?.active === true);

    const street2Configuration = SchemaUtil.getFieldConfig(Person, 'address.street2');
    assert(street2Configuration !== undefined);
    assert(street2Configuration.type === String);
  }

  @Test('Verify array of segments field config resolution')
  testSegmentArrayField() {
    const streetConfiguration = SchemaUtil.getFieldConfig(Person, ['address', 'street1']);
    assert(streetConfiguration !== undefined);
    assert(streetConfiguration.type === String);
  }

  @Test('Verify nested field within array of sub-schemas')
  testArraySubSchemaField() {
    const countListConfiguration = SchemaUtil.getFieldConfig(Person, 'counts');
    assert(countListConfiguration !== undefined);
    assert(countListConfiguration.type === Count);
    assert(countListConfiguration.array === true);

    const countValueConfiguration = SchemaUtil.getFieldConfig(Person, 'counts.value');
    assert(countValueConfiguration !== undefined);
    assert(countValueConfiguration.type === Number);
  }

  @Test('Verify inherited field resolution in subclasses')
  testInheritedField() {
    const unitConfiguration = SchemaUtil.getFieldConfig(SuperAddress, 'unit');
    assert(unitConfiguration !== undefined);
    assert(unitConfiguration.type === String);

    const inheritedStreetConfiguration = SchemaUtil.getFieldConfig(SuperAddress, 'street1');
    assert(inheritedStreetConfiguration !== undefined);
    assert(inheritedStreetConfiguration.type === String);
  }

  @Test('Verify non-existent fields return undefined')
  testNonExistentField() {
    assert(SchemaUtil.getFieldConfig(Person, 'nonExistent') === undefined);
    assert(SchemaUtil.getFieldConfig(Person, 'address.nonExistent') === undefined);
    assert(SchemaUtil.getFieldConfig(Person, 'address.street1.invalidChild') === undefined);
    assert(SchemaUtil.getFieldConfig(Address, 'nonExistent') === undefined);
  }

  @Test('Verify unregistered class returns undefined')
  testUnregisteredClass() {
    assert(SchemaUtil.getFieldConfig(UnregisteredClass, 'name') === undefined);
  }
}
