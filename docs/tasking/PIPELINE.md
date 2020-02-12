Pipelined Tasks
==============
[ ] Use worker threads in lieu of IPC (should be more robust)
  - [ ] Rework @trv/worker
  - [ ] Rework CLI invocation
  - [ ] Ensure @trv/exec is not intended for spawn/fork

[ ] Extract watch to it's own package, as it's dev only


Serverless Initiative
--------------------------
- [ ] Lambda for REST
  - [ ] Convert over to terraform
  - [ ] Support AWS/GCP and Azure
  - [x] Entire rest app as an AWS lambda
  - [x] Individual routes as individual lambdas
  - [x] API Gateway configuration
  - [ ] Auto deployment of application
  - [x] CLI entry point to facilitate