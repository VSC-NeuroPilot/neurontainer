<!-- markdownlint-disable MD033 -->

# neurontainer

`neurontainer` (pronounced neuron-tainer, all lowercase) is a Neuro integration that allows Neuro to communicate and control the Docker daemon, via the Docker Engine API.

<p align="center"><img src="./neurontainer.svg" width="512" alt="neurontainer logo by Pasu4"></p>

> **INSERT BIG WARNING HERE**
>
> You probably shouldn't open the control panel while screensharing, if your Neuro server is not ran on `localhost` (or `host.docker.internal` in our case).

## Neuro server connection

- The backend server/VM is connected to `ws://host.docker.internal:8000` (which is mapped to `localhost:8000`).
- Use the dashboard UI in Docker Desktop to configure the connected server if your Neuro server is elsewhere.

## Feature-completeness

Due to the incompleteness of the Docker TypeScript SDK, there are some missing features in the SDK that exist in the Docker Engine API.
While it is possible to implement directly via HTTP APIs or a community SDK, using the official SDK reliably ensures that we have to handle less things.

Implementation of missing features will be considered on a case-by-case basis. You can see currently planned features in the [to-do list](./TODO.md).

## Other information

- `neurontainer` is part of VSC-NeuroPilot. You can learn more about us [on our GitHub page](https://github.com/VSC-NeuroPilot).
- This project is licensed under the MIT license.
- You can find a list of planned features in our to-do Markdown file on the GitHub repo.
- The image includes the `package.json` files for the frontend, backend and main root, as well as the pnpm lockfile. You can use this to inspect the dependency tree of the tools we use.
