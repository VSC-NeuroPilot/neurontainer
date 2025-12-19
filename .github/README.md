<!-- markdownlint-disable MD033 -->

# neurontainer

`neurontainer` (pronounced neuron-tainer, all lowercase) is a Neuro integration that allows Neuro to communicate and control the Docker daemon, via the Docker Engine API.

<p align="center"><img src="../neurontainer.svg" width="512" alt="neurontainer logo by Pasu4"></p>

## Usage

Docker Desktop must be downloaded and installed from [the official Docker website](https://www.docker.com/).

You can then choose one of two ways to install the extension.

### Extension Hub

Once installed, go to the Extensions > Manage tab, click `Browse`, and search for `neurontainer`.

> [!NOTE]
> The initial version is not going to appear for a little bit as there is a small submissions process.
> If you don't see this image after restarting Docker Desktop, follow the Manual installation steps below.

### Manual installation

As `neurontainer` is just a Docker image, you can also install them manually. You will need the Docker CLI to do so.
You can obtain `neurontainer` images from these locations:

- KTrain5369's Docker Hub repository (`ktrain5369/neurontainer`)
- VSC-NeuroPilot's GitHub Container Registry (`ghcr.io/VSC-NeuroPilot/neurontainer`)

You'll need to do the following to install it this way:

- In Docker Desktop settings, go to Extension -> uncheck "Only allow extensions distributed through the Docker Marketplace".
- In the terminal, run `docker pull <container>` to pull the latest `neurontainer` image.

    `<container>` refers to the repository location, stated above in codeblocks.

    So if you want to pull from Docker Hub, replace `<container>` with `ktrain5369/neurontainer`.
    If you want to pull from GHCR, replace `<container>` with `ghcr.io/ktrain5369/neurontainer`.

    You can also search for the container on Docker Hub via the dashboard tab with the same name.

- After a successful pull, run `docker extension install neurontainer:latest` to install it as an extension.
- Every update, you'll need to pull from your chosen source again and run `docker extension update neurontainer:latest`.
