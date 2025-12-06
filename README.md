# neurontainer

`neurontainer` (pronounced neuron-tainer, all lowercase) is a Neuro integration that allows Neuro to communicate and control the Docker daemon, via the Docker Engine API.

## Usage

Docker must be downloaded and installed from [the official Docker website](https://www.docker.com/).
Once installed, look for the `neurontainer` image, and install it.

Alternatively, builds for `noderontainer` can also be pulled from VSC-NeuroPilot's GitHub Container Registry `(ghcr.io)`.

## Feature-completeness

Due to the incompleteness of the Docker TypeScript SDK, there are some missing features in the SDK that exist in the Docker Engine API.
While it is possible to implement directly via HTTP APIs or a community SDK, using the official SDK reliably ensures that we have to handle less things.
