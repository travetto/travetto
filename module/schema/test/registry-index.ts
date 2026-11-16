import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { SchemaRegistryIndex } from '@travetto/schema';
import { BeforeAll, Suite, Test } from '@travetto/test';

import { Address } from './models/address.ts';
import { Count, Person, SuperAddress } from './models/binding.ts';

class UnregisteredClass {
  name: string;
}

@Suite('Schema Registry Index')
class SchemaRegistryIndexTests {
  @BeforeAll()
  async initializeRegistry() {
    await Registry.init();
  }

  @Test('Verify root-level field config resolution')
  testRootField() {
    const nameConfiguration = SchemaRegistryIndex.getNestedFieldConfig(Person, 'name');
    assert(nameConfiguration !== undefined);
    assert(nameConfiguration.type === String);

    const ageConfiguration = SchemaRegistryIndex.getNestedFieldConfig(Person, 'age');
    assert(ageConfiguration !== undefined);
    assert(ageConfiguration.type === Number);

    const dateOfBirthConfiguration = SchemaRegistryIndex.getNestedFieldConfig(Person, 'dob');
    assert(dateOfBirthConfiguration !== undefined);
    assert(dateOfBirthConfiguration.type === Date);
  }

  @Test('Verify nested dotted field config resolution')
  testNestedField() {
    const streetConfiguration = SchemaRegistryIndex.getNestedFieldConfig(Person, 'address.street1');
    assert(streetConfiguration !== undefined);
    assert(streetConfiguration.type === String);
    assert(streetConfiguration.required?.active === true);

    const street2Configuration = SchemaRegistryIndex.getNestedFieldConfig(Person, 'address.street2');
    assert(street2Configuration !== undefined);
    assert(street2Configuration.type === String);
  }

  @Test('Verify array of segments field config resolution')
  testSegmentArrayField() {
    const streetConfiguration = SchemaRegistryIndex.getNestedFieldConfig(Person, ['address', 'street1']);
    assert(streetConfiguration !== undefined);
    assert(streetConfiguration.type === String);
  }

  @Test('Verify nested field within array of sub-schemas')
  testArraySubSchemaField() {
    const countListConfiguration = SchemaRegistryIndex.getNestedFieldConfig(Person, 'counts');
    assert(countListConfiguration !== undefined);
    assert(countListConfiguration.type === Count);
    assert(countListConfiguration.array === true);

    const countValueConfiguration = SchemaRegistryIndex.getNestedFieldConfig(Person, 'counts.value');
    assert(countValueConfiguration !== undefined);
    assert(countValueConfiguration.type === Number);
  }

  @Test('Verify inherited field resolution in subclasses')
  testInheritedField() {
    const unitConfiguration = SchemaRegistryIndex.getNestedFieldConfig(SuperAddress, 'unit');
    assert(unitConfiguration !== undefined);
    assert(unitConfiguration.type === String);

    const inheritedStreetConfiguration = SchemaRegistryIndex.getNestedFieldConfig(SuperAddress, 'street1');
    assert(inheritedStreetConfiguration !== undefined);
    assert(inheritedStreetConfiguration.type === String);
  }

  @Test('Verify caching returns identical reference')
  testCaching() {
    const firstCall = SchemaRegistryIndex.getNestedFieldConfig(Person, 'address.street1');
    const secondCall = SchemaRegistryIndex.getNestedFieldConfig(Person, 'address.street1');
    const thirdCallViaArray = SchemaRegistryIndex.getNestedFieldConfig(Person, ['address', 'street1']);

    assert(firstCall !== undefined);
    assert(firstCall === secondCall);
    assert(firstCall === thirdCallViaArray);
  }

  @Test('Verify non-existent fields return undefined')
  testNonExistentField() {
    assert(SchemaRegistryIndex.getNestedFieldConfig(Person, 'nonExistent') === undefined);
    assert(SchemaRegistryIndex.getNestedFieldConfig(Person, 'address.nonExistent') === undefined);
    assert(SchemaRegistryIndex.getNestedFieldConfig(Person, 'address.street1.invalidChild') === undefined);
    assert(SchemaRegistryIndex.getNestedFieldConfig(Address, 'nonExistent') === undefined);
  }

  @Test('Verify unregistered class returns undefined')
  testUnregisteredClass() {
    assert(SchemaRegistryIndex.getNestedFieldConfig(UnregisteredClass, 'name') === undefined);
  }
}
