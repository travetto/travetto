# Runtime Tips
- Avoid blocking the event loop during shutdown handlers.
- Be careful with process.exit() as it bypasses clean shutdown.
- Prefer Env and Runtime abstractions over reading process.env and process.cwd directly.
- Use JSONUtil/TimeUtil/ExecUtil/CodecUtil before introducing one-off helper implementations.
