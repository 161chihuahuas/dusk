# [🝰 dusk](https://rundusk.org)
# *contributor guide*
## --

> Looking for _user_ documentation? You're probably looking for the [User Guide](howto.md). ♥

## Quick Start

On Debian-based systems, run:

```
curl -o- https://rundusk.org/install.sh | bash
```

You can now use the `dusk` command line program and desktop entries for the graphical interface will be created. Running either will begin initial setup.

## Contributing

If you installed dusk already using the quick start script, then you have all the system dependencies needed for development installed. Just clone the repository:

```
git clone https://github.com/161chihuahuas/dusk.git
```

Enter the repository and install your development dependencies:

```
cd dusk
npm install
```

This repository contains the core library (`lib/`), the command line interface (`bin/`), and the [rundusk.org](https://rundusk.org) website which is generated from markdown files found here.

Test your changes for compatibility with:

```
npm test
```

To switch to using your development version, you can overwrite the link to the global version with:

```
npm link
```

## Testing

It is mostly straightforward to setup a test environment so you can learn about dusk and how it works. This is also very helpful if you are contributing to the project or developing an application on top of dusk. First you'll want to clone the `main` branch from the git repository and install dependencies. 

```
git clone https://github.com/161chihuahuas/dusk
cd dusk
npm install
```

From here, you can run the automated test suites:

```
npm run unit-tests
npm run integration-tests
npm run e2e-tests
npm run linter
```

> Running `npm test` will do all of the above.

Next, you'll probably want to setup a disposable test network to play with. A test network is a "live" network in that nodes communicate with each other like they otherwise would through Tor. The difference is that the difficulty parameters for identity creation are reduced and the secret keys are never saved. You can setup a testnet just using the `dusk` command line, but it may also be desirable to use Docker.

Setting up a testnet without Docker involves creating separate data directories for each node you want to run and modifying each configuration file to listen on different control sockets. Then starting each `dusk` process, letting them each bootstrap, then connecting each one to another using another `dusk` process to send them RPCs.

Using Docker, this can be reduced to a few commands and no configuration since each container is isolated and won't conflict with the others. Here is how to setup a testnet using Docker. 

**First**, build the Docker image (from the dusk source root directory):

```
docker build . -t dusk
```

Once completed, we can start our dusk nodes. We **only need 3** to form a functional network, so in 3 separate terminal windows, run:

```
docker run --publish 6275:5275 -it dusk --testnet --ephemeral
```
```
docker run --publish 7275:5275 -it dusk --testnet --ephemeral
```
```
docker run --publish 8275:5275 -it dusk --testnet --ephemeral
```

The `--publish [port:port]` option tells Docker to bind the first port on the host to the second port inside the container. Port `5275` is the default `ControlPort` that dusk receives local RPC messages on. We are exposing these to our host so we can use our host installation of dusk to control the nodes. The `--testnet` and `--ephemeral` options tell dusk to use lower solution difficulty and to create a disposable secret key. Eventually, all three nodes will say they are in "seed mode"/waiting for connections.

Now, we are going to find the dusk links for nodes 2 and 3 then use them to link from node 1. From a *new* terminal window:

```
dusk --rpc 'getinfo' --control-port 7275
dusk --rpc 'getinfo' --control-port 8275
```

Each of these commands will print a JSON object with a `dref` property. We want to issue node 1 a `connect` RPC for each of these.

```
dusk --rpc 'connect <dref from node 2>' --control-port 6275
dusk --rpc 'connect <dref from node 3>' --control-port 6275
```

They'll all find each other pretty quick. Check your terminal windows for your nodes. You should see that they are chatting and are aware of each other. You can repeat this process for as many nodes as you want to test against. You can also use `dusk --shred --dht --control-port 6275` and `dusk --retrace --dht --control-port 6275` to test file shredding and retracing over your testnet.

## Library

This package exposes a module providing a complete reference implementation 
of the protocol. To use it in your project, from your project's root 
directory, install as a dependency.

```
npm install @tacticalchihuahua/dusk --save
```

Then you can require the library with:

```
const dusk = require('@tacticalchihuahua/dusk');
```