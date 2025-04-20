'use strict';

const ini = require('ini');
const { existsSync, writeFileSync } = require('node:fs');
const mkdirp = require('mkdirp');
const { homedir } = require('node:os');
const { join } = require('node:path');

const DEFAULT_DATADIR = join(homedir(), '.config/dusk');

module.exports = function(datadir) {

  datadir = datadir || DEFAULT_DATADIR;

  const options = {

    AlwaysPromptToUpdate: '1',

    // Process PID
    DaemonPidFilePath: join(datadir, 'dusk.pid'),

    // Identity/Cryptography
    PrivateKeyPath: join(datadir, 'dusk.key'),
    PublicKeyPath: join(datadir, 'dusk.pub'),
    DrefLinkPath: join(datadir, 'dref'),
    PrivateKeySaltPath: join(datadir, 'salt'),
    IdentityNoncePath: join(datadir, 'nonce'),
    IdentityProofPath: join(datadir, 'proof'),

    // Database
    EmbeddedDatabaseDirectory: join(datadir, 'dusk.dat'),
    MetadataDirectory: join(datadir, 'dusk.dag'),
    VirtualFileSystemPath: join(datadir, 'dusk.vfs'),
    AutomaticallyShredVirtualFS: '1',

    // Node Options
    NodeListenPort: '5274',
    OnionVirtualPort: '80',
    OnionHiddenServiceDirectory: join(datadir, 'dusk.hs'),
    OnionLoggingVerbosity: 'notice',
    OnionLoggingEnabled: '0',

    // WebDAV
    WebDAVEnabled: '1',
    WebDAVListenPort: '5276',
    WebDAVRootUsername: 'dusk',
    WebDAVAnonDropboxEnabled: '1',
    WebDAVLinkShareEnabled: '1',
    WebDAVHiddenServiceDirectory: join(datadir, 'webdav.hs'),

    // Network Bootstrapping
    NetworkBootstrapNodes: [

    ],

    // Debugging/Developer
    VerboseLoggingEnabled: '1',
    LogFilePath: join(datadir, 'dusk.log'),
    LogFileMaxBackCopies: '3',

    // Local Control Protocol
    ControlPortEnabled: '0',
    ControlPort: '5275',
    ControlSockEnabled: '1',
    ControlSock: join(datadir, 'control.sock'),

    // Enables the Test Mode (lowers difficulty)
    TestNetworkEnabled: '0'

  };

  if (!existsSync(join(datadir, 'config'))) {
    mkdirp.sync(datadir);
    writeFileSync(join(datadir, 'config'), ini.stringify(options));
  }

  if (!existsSync(join(datadir, 'dusk.dat'))) {
    mkdirp.sync(join(datadir, 'dusk.dat'));
  }

  if (!existsSync(join(datadir, 'dusk.dag'))) {
    mkdirp.sync(join(datadir, 'dusk.dag'));
  }
  return options;
};
