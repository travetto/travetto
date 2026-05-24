# Worker Instructions
How to orchestrate background process work safely.

## Setup
1. Install @travetto/worker.
2. Define task payload/result contracts.
3. Select pool size based on workload and host constraints.

## Usage Workflow
- Create a `WorkPool` for your worker task type.
- Dispatch jobs with bounded concurrency.
- Use `IpcChannel` for custom status/control messaging.

Minimal pattern:
1. Initialize pool.
2. Submit jobs.
3. Await results and handle failures/retries.

## Safe Defaults
- Keep pool sizes conservative and measured.
- Keep IPC payloads compact.
- Ensure graceful shutdown and error handling paths are tested.
