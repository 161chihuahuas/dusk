# [🝰 dusk](https://rundusk.org)

## User Guide

* [Installation](#installation)
* [Setup](#setup)
* [Basics](#basics)
* [Advanced](#advanced)
* [Configuration](#configuration)
* [Sneakernets](#sneakernets)

---

### Installation

The simplest way to install dusk is running the install script from the console on a Debian-based system. Using [Tails](https://tails.net/)) with persistence on a USB or inside a virtual machine on any operating system is recommended.

```
curl -o- https://rundusk.org/install.sh | bash
```

You may be prompted for your password.

#### Virtualization

TODO
> What? Why? How?

#### Debian Users

TODO
> Developed on Debian Testing under GNOME desktop
> Mac users should consider migrating ;)
> Directly on host
> On a Tails USB
> GNOME boxes, port access, etc
> Docker

#### MacOS Users

TODO
> UTM, port access, ftp, etc
> Docker

#### Windows Users

TODO
> Windows users should expect a similar process as macOS with VirtualBox, but Windows installation is not officially supported.

### Setup

Once you have installed dusk or linked it as a global package, open your Terminal and run `dusk --help`.

The CLI will print a list of options and what they do. This is where you'll find tools to interact with dusk. But first you have to start dusk for the first time! In that same Terminal just run `dusk`.

The CLI will prompt you to enter a password to protect the key it generated. Then, it will print a list of words and tell you to write them down. Do that and run `dusk` again.

Now dusk will start bootstrapping the Tor network connection and eventually it will say it's listening for connections. Now you'll want to connect to someone to discover more of the network. But how? There is no signaling server, no DNS seeds, or list of operating nodes (yet). So, here is where your IRL network comes into play.

Maybe it's your affinity group, your research team, your friends - they need to run dusk too. And you'll exchange "identity bundles" to bootstrap from each other. To do that, we need to ask our dusk node for it. In *another* Terminal, run `dusk --link`.

This is like your username. It contains information about how to communicate with your dusk node. Note that your link contains your onion address. Sharing it online could create a anonymity compromise. Share it with your network out of band. When you have exchanged links, run `dusk --rpc "connect <link>"`.

You need a minimum of 3 dusk nodes to form a functioning network. These could be friends, family, colleagues, members of your affinity group, etc. dusk can operate segmented to a small community or connected to a wider global network. 

Run your dusk node in the background with `dusk --daemon`. 

### Basics

> TODO graphical and text menus howto
> TODO FTP Bridge

The dusk CLI provides a number of tools for interacting with dusk and the network, but there are 2 primary operations to familiarize yourself with first: shred and retrace. 

#### `--shred`

**Shred** takes a file, encrypts it to your key, splits it up into equal segments, generates parity segments (for recovery from data loss), creates a metadata pointer, encrypts the metadata, and depending on your choice either: writes the pieces to a special folder called a `duskbundle`, stores the pieces in the network using the DHT, or transfers them across an array of USB drives (see [Sneakernets](#sneakernets).

To shred a file and store the pieces in the DHT using the control port:

```
dusk --shred --dht --control-port 5275
```

dusk will talk you through the process and keep you updated on progress.

#### `--retrace`

**Retrace** takes an encrypted metadata pointer, decrypts it then depending on your choice either: reads the pieces from a `duskbundle`, downloads the pieces from the network, or reads them from an array of USB drives. Then, retrace will reassmble the pieces, encode any corrupted or missing pieces, decrypt the original file, and save it.

To retrace the same file from the previous example from the DHT:

```
dusk --retrace --dht --control-port 5275
```

dusk will talk you through the process and keep you updated on progress.

### Advanced

The next most important feature is dusk's publish/subscribe system. Nodes can receive arbitrary publications announced through the network by adding the fingerprint of the publisher to their subscriptions. Whenever dusk is handed a PUBLISH message it is interested in, it can trigger a webhook to a onion address.

#### `--test-hooks`

If you are developing an application that uses the pub/sub system, your application will expose an onion service where dusk can send POST requests with the publication contents in the body. Your application can then validate and process those messages according to your needs.

You can test this out using the `--test-hooks` option - which will start a simple onion service that prints messages it receives from dusk to the console. *Do not use this AS IS in production.*

### Configuration

A dusk node requires a configuration file to get up and running. The path to this 
file is given to `dusk` when starting a node (or the defaults will be used).

```
dusk --config myconfig.ini
```

If a configuration file is not supplied, a minimal default configuration is 
automatically created and used, which will generate a private key, database, 
and other necessary files. All of this data will be created and stored in 
`$HOME/.config/dusk`, unless a `--datadir` option is supplied. Valid configuration 
files may be in either INI or JSON format.

#### DaemonPidFilePath

##### Default: `$HOME/.config/dusk/dusk.pid`

The location to write the PID file for the daemon.

#### PublicKeyPath

##### Default: `$HOME/.config/dusk/dusk.pub`

Path to public key key file.

#### PrivateKeyPath

##### Default: `$HOME/.config/dusk/dusk.key`

Path to private key key file to use for identity.

#### EmbeddedDatabaseDirectory

##### Default: `$HOME/.config/dusk/dusk.dht`

Sets the directory to store DHT entries.

#### NodeListenPort

##### Default: `5274`

Sets the local port to bind the node's RPC service.

#### NodeListenAddress

##### Default: `0.0.0.0`

Sets the address to bind the RPC service.

#### VerboseLoggingEnabled

##### Default: `1`

More detailed logging of messages sent and received. Useful for debugging.

#### LogFilePath

##### Default: `$HEAD/.config/dusk.log`

Path to write the daemon's log file. Log file will rotate either every 24 hours 
or when it exceeds 10MB, whichever happens first.

#### LogFileMaxBackCopies

##### Default: `3`

Maximum number of rotated log files to keep.

#### NetworkBootstrapNodes[]

##### Default: `(empty)`

Add a map of network bootstrap nodes to this section to use for discovering 
other peers. Default configuration should come with a list of known and 
trusted contacts.

#### OnionVirtualPort

##### Default: `443`

The virtual port to use for the hidden service.

#### OnionHiddenServiceDirectory

##### Default: `$HOME/.config/dusk/hidden_service`

The directory to store hidden service keys and other information required by 
the Tor process.

#### OnionLoggingEnabled

##### Default: `0`

Redirects the Tor process log output through dusk's logger for the purpose of 
debugging.

#### OnionLoggingVerbosity

##### Default: `notice`

Defines the verbosity level of the Tor process logging. Valid options are: 
`debug`, `info`, `notice`.

#### ControlPortEnabled

##### Default: `0`

Enables the {@link Control} interface over a TCP socket.

#### ControlPort

##### Default: `5275`

The TCP port to for the control interface to listen on.

#### ControlSockEnabled

##### Default: `1`

Enables the {@link Control} interface over a UNIX domain socket.

#### ControlSock

##### Default: `$HOME/.config/dusk/dusk.sock`

The path to the file to use for the control interface.

#### TestNetworkEnabled

##### Default: `0`

Places dusk into test mode, significantly lowering the identity solution
difficulty and the permission solution difficulty.

### Sneakernets

"Sneakernet" is an informal term that refers to transferring data between parties using physical media, like a USB drive, instead of networks. In scenarios where bandwidth is limited, internet access is unavailable, or in cases where the threat model warrants that some data not be transmitted over the internet, sneakernets offer security. They do this in the form of a greatly reduced attack surface, because unauthorized access to data over a sneakernet requires physical access to the media it is stored on.

dusk is built with sneakernets as a transmission model in mind. A subset of the shred/retrace protocol is implemented to function without network access - instead using an array of USB drives. This is called dusk/SHOES (dusk over shoes). SHOES is an acronym for Simple Human Operated Encrypted Sneakernet.

#### dusk/SHOES

> This feature is experimental.

The dusk CLI includes a `--shoes` option that can be used in 3 ways:

* `dusk --shoes` will setup a new dusk/SHOES USB
* `dusk --shred --shoes` will encrypt/shred/encode/distribute a file to `n` USB drives
* `dusk --retrace --shoes` will retrace a file from `n` USB drives, then decrypt and save

Setting up a dusk/SHOES USB functions a lot like setting up dusk on first run. All of the configuration, identity keys, and data directories are created on the USB. The dusk/SHOES USB can even be used to run dusk online later.
Shredding a file follows a guided prompt. Retracing follows a similar process.
