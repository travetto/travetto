Encore: Registry
=================

Two Flow:
 - On load (prod use case)
  - RootRegistry will load all appropriate files
  - As files are loaded, they record their various metadatas 
  - When all requires are done
    - RootRegistry is finished
    - Any things depending on RootRegistry will run
    - This ensures all files are loaded and processed before application starts

 - At runtime (dev use case)
  - RootRegistry will listen to the TS Compiler watcher and track which files have changed
    and will trigger class based updates (assuming everything is indexed via class __id) 