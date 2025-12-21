# To-do list

## Definitely do these

- Round out RCE system construction
- More implementation of actions
- Add a separate version for headless/non-Docker Desktop environments
  - pre-requisite: make a "shared" package with the core logic to share across both versions
  - consider making a separate web app for this as well
- Log streaming to frontend (does WebSocket or SSE even work?)
- Config schema & storage
- Logging verbosity setting (e.g. error/warn/info/debug)
- Toggle for separate error log file output
- Cookie count
- ESLint rules (catching `erm`s when)

## Consider these

- Switch from official Node.js Docker Engine SDK to a more complete community-maintained one
- Use Fastify instead of Hono as the web framework
- Unit testing (Vitest & Mocha/Jest)
- Better DX for testing the backend bro
