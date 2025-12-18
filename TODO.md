# To-do list

## Definitely do these

- Full RCE system construction
- More implementation of actions
- Add a separate version for headless/non-Docker Desktop environments
  - pre-requisite: make a "shared" package with the core logic to share across both versions
  - consider making a separate web app for this as well
- Log streaming to frontend (does WebSocket or SSE even work?)
- Config schema & storage

## Consider these

- Switch from official Node.js Docker Engine SDK to a more complete community-maintained one
- Use Fastify instead of Hono as the web framework
- Unit testing
