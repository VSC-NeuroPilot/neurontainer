<!-- markdownlint-disable MD033 -->

# neurontainer

`neurontainer` (pronounced neuron-tainer, all lowercase) is a Neuro integration that allows Neuro to communicate and control the Docker daemon, via the Docker Engine API.

<p align="center"><img src="./neurontainer.svg" width="512" alt="neurontainer logo by Pasu4"></p>

## Usage

Docker must be downloaded and installed from [the official Docker website](https://www.docker.com/).
Once installed, look for the `neurontainer` image, and install it.

Alternatively, builds for `noderontainer` can also be pulled from VSC-NeuroPilot's GitHub Container Registry `(ghcr.io)`.

### Neuro server connection

- The server is connected to `ws://host.docker.internal:8000` (which is mapped to `localhost:8000`).
- Use the dashboard UI in Docker Desktop to configure the connected server if your Neuro server is elsewhere.

## Feature-completeness

Due to the incompleteness of the Docker TypeScript SDK, there are some missing features in the SDK that exist in the Docker Engine API.
While it is possible to implement directly via HTTP APIs or a community SDK, using the official SDK reliably ensures that we have to handle less things.

Implementation of missing features will be considered on a case-by-case basis. You can see currently planned features in the [to-do list](./TODO.md).
