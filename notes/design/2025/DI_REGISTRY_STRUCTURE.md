# Dependency Registry Behavior

## Sources

### Class
* Primary data points
   - Self/class (listen for changes)
   - Constructor parameters (Dependency list)
   - Implements
   - Parent extends
   - Injectable Fields (Dependency map)
   - Qualifier (Supports making multiple)
   - Is Primary? (Should this implementation be treated as the primary, should never be set in a library)
   - Is abstract?
   - Target? What type should this connect to?  Allows for injecting non-owned classes
* A class
* Extensible via implements and extends
* Polymorphism acts as a pattern for loading similar contracts

### Factory
* A function, currently living as a static method on a class
* Primary data points
   - Declaration class (listen for changes)
   - Method parameters (Dependency list)
   - Return type (The default build target) 
      - This points to the class above.
   - Qualifier (Supports making multiple)
   - Is Primary? (Should this implementation be treated as the primary, should never be set in a library)
   - Target? What type should this connect to?  Allows for injecting non-owned classes



## Main Concepts
* class for watching reload
  * Class - self
  * Factory - where function is registered
* The registration type
  * Class - self
  * Factory - return type
* Injectable Constructor params
  * Class - self
  * Factory - method params
* Injectable Fields
  * Class - self fields
  * Factory - Return type class fields
* Target
  * Class - Decorator value
  * Factory - Decorator value
* Qualifier
  * Class - Decorator value
  * Factory - Decorator value


## Construction
### Classes
* Pretty straightforward
* Register by self, parent, and interfaces
* On construct
    * Resolve constructor params
    * Invoke constructor
    * Resolve fields that aren't defined
    * Call post construct

### Factories
* Register by Return type
  * Parent, and interfaces
* On construct
   * Resolve method parameters
   * Invoke method
   * Inject fields as needed, into returned item
   * Call post construct