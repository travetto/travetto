# Registry Instructions
How to use registry primitives for framework extension work.

## Setup
1. Define a RegistryAdapter for the metadata you want to collect.
2. Define a RegistryIndex (optionally backed by RegistryIndexStore).
3. Register lifecycle wiring during framework/module initialization.

## Usage Workflow
- Capture metadata during decorator or registration phases.
- Finalize index state after discovery completes.
- Query index data through explicit read APIs at runtime.

Minimal pattern:
1. Register metadata through adapter callbacks.
2. Build/finalize deterministic index state.
3. Expose read-only lookup interfaces for downstream modules.

## Safe Defaults
- Keep registry writes limited to initialization phases.
- Keep index data deterministic and free from runtime mutation surprises.
- Prefer narrow, typed lookup surfaces over generic map exposure.
