#!/usr/bin/env sh
':' //; exec "$(command -v node || command -v nodejs)" "$0" "$@"

'use strict';

const { spawn } = require('node:child_process');
const { homedir } = require('node:os');
const assert = require('node:assert');
const async = require('async');
const program = require('commander');
const dusk = require('../index');
const bunyan = require('bunyan');
const RotatingLogStream = require('bunyan-rotating-file-stream');
const fs = require('node:fs');
const path = require('node:path');
const options = require('./config');
const npid = require('npid');
const daemon = require('daemon');
const levelup = require('levelup');
const leveldown = require('leveldown');
const boscar = require('boscar');
const rc = require('rc');
const encoding = require('encoding-down');
const secp256k1 = require('secp256k1');
const readline = require('node:readline');
const bip39 = require('bip39');
const inquirer = require('inquirer');
const { encrypt } = require('eciesjs');
const { fromBuffer } = require('../lib/dag-entry');


program.version(dusk.version.software);

const description = `
             _/                      _/      
        _/_/_/  _/    _/    _/_/_/  _/  _/   
     _/    _/  _/    _/  _/_/      _/_/      
    _/    _/  _/    _/      _/_/  _/  _/     
     _/_/_/    _/_/_/  _/_/_/    _/    _/    

        (d)arknet (u)nder (s/k)ademlia

                    ~ Ⓐ ~
                                           
         N©! 2024 tactical chihuahua 
         licensed under the AGPL-3.0
`;

program.description(description);
program.option('--config, -C <file>', 'path to a dusk configuration file',
  path.join(homedir(), '.config/dusk/dusk.ini'));
program.option('--datadir <path>', 'path to the default data directory',
  path.join(homedir(), '.config/dusk'));
program.option('--kill', 'sends the shutdown signal to the daemon');
program.option('--testnet', 'runs with reduced identity difficulty');
program.option('--daemon, -D', 'sends the dusk daemon to the background');
program.option('--quiet, -Q', 'silence terminal output that is not necessary');
program.option('--rpc [method] [params]', 'send a command to the daemon');
program.option('--repl', 'starts the interactive rpc console');
program.option('--logs, -F', 'tails the log file defined in the config');
program.option('--export, -X', 'dumps the public identity key');
program.option('--export-secret', 'dumps the private identity key');
program.option('--export-recovery', 'dumps the bip39 recovery words');
program.option('--shred [message]', 'splits and pads message into uniform shards');
program.option('--ephemeral', 'use with --shred to generate a one-time use identity key');
program.option('--encrypt [message]', 'encrypt a message for yourself');
program.option('--pubkey [pubkey]', 'use with --encrypt to set target or alone to print your key');
program.option('--decrypt <message>', 'decrypts the message for yourself');
program.option('--file-in <path>', 'specify file path to read');
program.option('--file-out <path>', 'specift file path to write');
program.parse(process.argv);

let argv;

if (program.datadir) {
  argv = { config: path.join(program.datadir, 'config') };
  program.config = argv.config;
}

if (program.testnet) {
  process.env.dusk_TestNetworkEnabled = '1';
}

if (!program.Q) {
  console.log(description);
}

let config = rc('dusk', options(program.datadir), argv);
let privkey, identity, logger, controller, node, nonce, proof;

// Initialize logging
const prettyPrint = spawn(
  path.join(__dirname, '../node_modules/bunyan/bin/bunyan'),
  ['--color']
);

logger = bunyan.createLogger({
  name: 'dusk',
  streams: [
    {
      stream: new RotatingLogStream({
        path: config.LogFilePath,
        totalFiles: parseInt(config.LogFileMaxBackCopies),
        rotateExisting: true,
        gzip: false
      })
    },
    { stream: prettyPrint.stdin }
  ],
  level: parseInt(config.VerboseLoggingEnabled) ? 'debug' : 'info'
});

if (!program.Q) {
  prettyPrint.stdout.pipe(process.stdout);
}


async function _init() {
  if (parseInt(config.TestNetworkEnabled)) {
    logger.info('dusk is running in test mode, difficulties are reduced');
    process.env.dusk_TestNetworkEnabled = config.TestNetworkEnabled;
    dusk.constants.IDENTITY_DIFFICULTY = dusk.constants.TESTNET_DIFFICULTY;
  }

  // Generate a private extended key if it does not exist
  if (!fs.existsSync(config.PrivateKeyPath)) {
    const questions = [
      {
        type: 'password',
        name: 'password1',
        message: 'I made you a key, enter a password to protect it? ~>',
      },
      {
        type: 'password',
        name: 'password2',
        message: 'Once more, to make sure? ♥ ~>'
      }
    ];

    const answers = await inquirer.default.prompt(questions);

    if (answers.password1 !== answers.password2) {
      logger.error('Passwords do not match, try again?');
      return _init();
    }
    const sk = dusk.utils.generatePrivateKey();
    const salt = fs.existsSync(config.PrivateKeySaltPath)
      ? fs.readFileSync(config.PrivateKeySaltPath)
      : crypto.getRandomValues(Buffer.alloc(16));
    const encryptedPrivKey = dusk.utils.passwordProtect(answers.password1, salt, sk);

    fs.writeFileSync(config.PrivateKeySaltPath, salt);
    fs.writeFileSync(config.PrivateKeyPath, encryptedPrivKey);
    fs.writeFileSync(config.PublicKeyPath, secp256k1.publicKeyCreate(sk));
    console.log(`
  Your key is protected, don\'t forget your password!
  Write these words down, keep them safe.

  You can also write down all but a few you can remember, I'll trust your judgement.
  If you lose these words, you can never recover access to this identity, including
  any data encrypted for your secret key.

  [  ${bip39.entropyToMnemonic(sk.toString('hex'))}  ]
      
  Come back and run dusk again where you\'re ready. ♥
    `);
    process.exit(0);
  }

  if (fs.existsSync(config.IdentityProofPath)) {
    proof = fs.readFileSync(config.IdentityProofPath);
  }

  if (fs.existsSync(config.IdentityNoncePath)) {
    nonce = parseInt(fs.readFileSync(config.IdentityNoncePath).toString());
  }

  if (program.shutdown) {
    try {
      process.kill(parseInt(
        fs.readFileSync(config.DaemonPidFilePath).toString().trim()
      ), 'SIGTERM');
    } catch (err) {
      logger.error('failed to shutdown daemon, is it running?');
      process.exit(1);
    }
    process.exit(0);
  }

  if (program.X) {
    const pubbundle = fs.readFileSync(
      path.join(program.datadir, 'dusk.pub')
    ).toString();

    if (program.Q) {
      console.log(pubbundle);
    } else {
      console.log('public bundle ♥ ~ [  %s  ] ', pubbundle);
    }
    process.exit(0);
  }

  if (program.shred) {
    if (!program.encrypt) {
      const questions = [
        {
          type: 'confirm',
          name: 'trustme',
          message: 'I\'m trusting that you encrypted this file yourself? ~>',
        },
        {
          type: 'confirm',
          name: 'ipromise',
          message: 'Are you absolutely sure you ran [ dusk --encrypt --file-in <filepath> ]? ♥ ~>'
        }
      ];

      const answers = await inquirer.default.prompt(questions);

      if (!answers.trustme || !answers.ipromise) {
        console.log(`
    Thanks for being honest, now go run:
    [ dusk --encrypt --file-in <filepath> ]

    You can also do this in one step with: 
    [ dusk --shred --encrypt [pubkey] --file-in <filepath> ]'
        `);        
        console.error('Aborting, try again?');
        process.exit(1);
      }
    }

    console.log('');
    

    if (program.ephemeral && program.pubkey) {
      console.error('i don\'t know how to encrypt this because --ephemeral and --pubkey contradict');
      console.error('choose one or the other');
      process.exit(1);
    }

    if (program.ephemeral) {
      const sk = dusk.utils.generatePrivateKey();
      const words = bip39.entropyToMnemonic(sk.toString('hex'));
      program.pubkey = Buffer.from(secp256k1.publicKeyCreate(sk));

      console.log(`
  I generated a new key, but I didn't store it.
  I'll encrypt using it, but you'll need to write these words down:

[  ${words}  ]

  If you lose these words, you won't be able to recover this file from
  a reconstructed bundle - it will be gone forever.
      `);
    }

    let publicKey = program.pubkey || fs.readFileSync(config.PublicKeyPath);
    
    let entry;
    if (typeof program.shred === 'string') {
      entry = dusk.utils.encrypt(Buffer.from(publicKey, 'hex'), Buffer.from(program.shred, 'hex'));
    } else if (program.fileIn) {
      entry = dusk.utils.encrypt(Buffer.from(publicKey, 'hex'), fs.readFileSync(program.fileIn));
    } else {
      console.error('i don\'t know what to shred :(');
      console.error('include a hex string after --shred or specify a --file-in <path>');
      process.exit(1);
    }

    const dagEntry = await dusk.DAGEntry.fromBuffer(entry);
    
    if (!program.Q) {
      for (let i = 0; i < dagEntry.merkle.levels(); i++) {
        console.log(`merkle level${i} ~ [`);;
        const level = dagEntry.merkle.level(i).forEach(l => {
          console.log(`merkle level${i} ~ [  ${l.toString('hex')}  ] `);;
        });
        console.log(`merkle level${i} ~ [`);
      }
    }

    if (!program.fileOut || typeof program.fileOut !== 'string') {
      if (program.fileIn) {
        program.fileOut = program.fileIn + '.duskbundle';
      } else {
        console.warn('you didn\'t specify a --file-in or --file-out so i wont\'t write anything');
      }
    }

    if (fs.existsSync(program.fileOut)) {
      console.error('file %s already exists, i won\'t overwrite it', program.fileOut);
      process.exit(1);
    }
    
    if (program.fileOut) fs.mkdirSync(program.fileOut);
    
    for (let s = 0; s < dagEntry.shards.length; s++) {
      if (program.fileOut) {
        fs.writeFileSync(path.join(
          program.fileOut, 
          `${String(s+1).padStart(4, '0')}.${dagEntry.merkle._leaves[s].toString('hex')}.part`
        ), dagEntry.shards[s]);
      }
    }

    const meta = dagEntry.toMetadata(program.fileIn || '');
    const metaEnc = dusk.utils.encrypt(program.pubkey, meta);
    const metaEntry = await dusk.DAGEntry.fromBuffer(metaEnc);

    if (program.fileOut) {
      fs.writeFileSync(path.join(program.fileOut, 
        `0000.${metaEntry.merkle.root().toString('hex')}.meta`), 
        metaEntry.shards[0]
      );
    }

    if (!program.Q) {
      if (program.fileOut) {
        console.log('');
        console.log('bundle written ♥ ~ [  %s  ] ', program.fileOut);
        console.log('');
      } else {
        console.log('');
        console.log('meta hash ♥ ~ [  %s  ] ', metaEntry.merkle.root().toString('hex'));
        console.log('');
        console.warn('that was a dry run, i didn\'t actually write anything to disk');
        console.warn('when you\'re ready, try again with --file-in / --file-out');
      }
    }
    process.exit(0);
  }


  if (program.daemon) {
    require('daemon')({ cwd: process.cwd() });
  }

  try {
    npid.create(config.DaemonPidFilePath).removeOnExit();
  } catch (err) {
    logger.error('Failed to create PID file, is dusk already running?');
    process.exit(1);
  }

  // Shutdown children cleanly on exit
  process.on('exit', killChildrenAndExit);
  process.on('SIGTERM', killChildrenAndExit);
  process.on('SIGINT', killChildrenAndExit);
  process.on('uncaughtException', (err) => {
    npid.remove(config.DaemonPidFilePath);
    logger.error(err.message);
    logger.debug(err.stack);
    process.exit(1);
  });
  process.on('unhandledRejection', (err) => {
    npid.remove(config.DaemonPidFilePath);
    logger.error(err.message);
    logger.debug(err.stack);
    process.exit(1);
  });

  // Initialize private extended key
  privkey = await (new Promise(async (resolve, reject) => {
    const encryptedPrivKey = fs.readFileSync(config.PrivateKeyPath);
    const questions = [{
      type: 'password',
      name: 'password',
      message: 'Enter password to unlock your key? ~>',
    }];
    const answers = await inquirer.default.prompt(questions);
    const salt = fs.readFileSync(config.PrivateKeySaltPath);
    const sk = dusk.utils.passwordUnlock(answers.password, salt, encryptedPrivKey);
    resolve(sk);
  }));
  identity = new dusk.eclipse.EclipseIdentity(
    Buffer.from(secp256k1.publicKeyCreate(privkey)),
    nonce,
    proof
  );
  
  if (program.exportSecret) {
    // TODO store this encrypted and prompt for password EVERY time
    if (program.Q) {
      console.log(privkey.toString('hex'));
    } else {
      console.log('secret key ♥ ~ [  %s  ] ', privkey.toString('hex'));
    }
    process.exit(0);
  }

  if (program.exportRecovery) {
    // TODO store this encrypted and prompt for password EVERY time
    if (program.Q) {
      console.log(bip39.entropyToMnemonic(privkey.toString('hex')));
    } else {
      console.log('recovery words ♥ ~ [  %s  ] ', bip39.entropyToMnemonic(privkey.toString('hex')));
    }
    process.exit(0);
  }
  let pubkey = Buffer.from(secp256k1.publicKeyCreate(privkey)).toString('hex');

  if (program.encrypt) {
    if (typeof program.pubkey === 'string') {
      pubkey = program.pubkey;
    } else {
      pubkey = Buffer.from(secp256k1.publicKeyCreate(privkey)).toString('hex');
    }

    if (program.fileIn) {
      program.encrypt = fs.readFileSync(program.fileIn).toString('hex');
    }

    let ciphertext = dusk.utils.encrypt(pubkey, program.encrypt).toString('hex');
    
    if (program.fileOut) {
      if (fs.existsSync(program.fileOut)) {
        console.error('file already exists, i won\'t overwrite it');
        process.exit(1);
      }
      fs.writeFileSync(program.fileOut, Buffer.from(ciphertext, 'hex'));
      console.log('encrypted ♥ ~ [  file: %s  ] ', program.fileOut);
    } else if (!program.Q) {
      console.log('encrypted ♥ ~ [  %s  ] ', ciphertext);
    } else {
      console.log(ciphertext);
    }

    process.exit(0);
  }

  if (program.pubkey) {
    if (!program.Q) {
      console.log('public key ♥ ~ [  %s  ] ', pubkey);
    } else {
      console.log(pubkey);
    }
    process.exit(0);
  }

  if (program.decrypt) {
    let cleartext = dusk.utils.decrypt(privkey.toString('hex'), program.decrypt);
    if (!program.Q) {
      console.log('decrypted ♥ ~ [  %s  ] ', cleartext);
    } else {
      console.log(cleartext);
    }
    process.exit(0);
  }
  
  // If identity is not solved yet, start trying to solve it
  let identityHasValidProof = false;

  logger.info(`proof difficulty param N=${dusk.constants.IDENTITY_DIFFICULTY.n}`);
  logger.info(`proof difficulty param K=${dusk.constants.IDENTITY_DIFFICULTY.k}`);

  try {
    identityHasValidProof = await identity.validate();
  } catch (err) {
    logger.warn(`identity validation failed, ${err.message}`);
  }

  if (!identityHasValidProof) {
    logger.info(`identity proof not yet solved, this can take a while`);
    await identity.solve();
    fs.writeFileSync(config.IdentityNoncePath, identity.nonce.toString());
    fs.writeFileSync(config.IdentityProofPath, identity.proof);
    logger.info('identity solution found');
  }

  logger.info(`pubkey ${identity.pubkey.toString('hex')}`);
  logger.info(`proof: ${identity.proof.toString('hex')}`);
  logger.info(`nonce: ${identity.nonce}`);
  logger.info(`fingerprint ${identity.fingerprint.toString('hex')}`);
  init();
}

function killChildrenAndExit() {
  logger.info('exiting, killing child services, cleaning up');
  npid.remove(config.DaemonPidFilePath);
  process.removeListener('exit', killChildrenAndExit);

  if (controller && parseInt(config.ControlSockEnabled)) {
    controller.server.close();
  }

  process.exit(0);
}

function registerControlInterface() {
  assert(!(parseInt(config.ControlPortEnabled) &&
           parseInt(config.ControlSockEnabled)),
  'ControlSock and ControlPort cannot both be enabled');

  controller = new boscar.Server(new dusk.Control(node));

  if (parseInt(config.ControlPortEnabled)) {
    logger.info('binding controller to port ' + config.ControlPort);
    controller.listen(parseInt(config.ControlPort), '0.0.0.0');
  }

  if (parseInt(config.ControlSockEnabled)) {
    logger.info('binding controller to path ' + config.ControlSock);
    controller.listen(config.ControlSock);
  }
}

async function init() {
  logger.info('initializing dusk');

  // Initialize public contact data
  const contact = {
    hostname: '',
    protocol: 'http:',
    port: parseInt(config.NodePublicPort)
  };

  const transport = new dusk.HTTPTransport();

  // Initialize protocol implementation
  node = new dusk.KademliaNode({
    logger,
    transport,
    contact,
    storage: levelup(encoding(leveldown(config.EmbeddedDatabaseDirectory)))
  });
  
  // Extend S/Kademlia with Quasar pub/sub
  node.plugin(dusk.quasar());
  // Sign and verify messages
  node.spartacus = node.plugin(dusk.spartacus(privkey, {
    checkPublicKeyHash: false
  }));
  // DHT is content addressable only - no arbitrary k/v pairs
  node.content = node.plugin(dusk.contentaddress({
    valueEncoding: 'hex'
  }));
  // Mitigage exclipse attacks by requiring equihash proofs
  node.eclipse = node.plugin(dusk.eclipse(identity));

  // Route all traffic through Tor and establish an onion service
  dusk.constants.T_RESPONSETIMEOUT = 20000;
  node.onion = node.plugin(dusk.onion({
    dataDirectory: config.OnionHiddenServiceDirectory,
    virtualPort: config.OnionVirtualPort,
    localMapping: `127.0.0.1:${config.NodeListenPort}`,
    torrcEntries: {
      // dusk-specific Tor configuration
      CircuitBuildTimeout: 10,
      KeepalivePeriod: 60,
      NewCircuitPeriod: 60,
      NumEntryGuards: 8,
      Log: `${config.OnionLoggingVerbosity} stdout`
    },
    passthroughLoggingEnabled: !program.Q && !!parseInt(config.OnionLoggingEnabled)
  }));

  // Handle any fatal errors
  node.on('error', (err) => {
    logger.error(err.message.toLowerCase());
  });

  // Use verbose logging if enabled
  if (!!parseInt(config.VerboseLoggingEnabled)) {
    node.plugin(dusk.logger(logger));
  }

  // Cast network nodes to an array
  if (typeof config.NetworkBootstrapNodes === 'string') {
    config.NetworkBootstrapNodes = config.NetworkBootstrapNodes.trim().split();
  }

  async function joinNetwork(callback) {
    let peers = config.NetworkBootstrapNodes;

    if (peers.length === 0) {
      logger.info('no bootstrap seeds provided');
      logger.info('running in seed mode (waiting for connections)');

      return node.router.events.once('add', (identity) => {
        config.NetworkBootstrapNodes = [
          dusk.utils.getContactURL([
            identity,
            node.router.getContactByNodeId(identity)
          ])
        ];
        logger.info(config.NetworkBootstrapNodes)
        joinNetwork(callback)
      });
    }

    logger.info(`joining network from ${peers.length} seeds`);
    async.detectSeries(peers, (url, done) => {
      const contact = dusk.utils.parseContactURL(url);
      logger.info('contacting', contact);
      node.join(contact, (err) => {
        done(null, (err ? false : true) && node.router.size > 1);
      });
    }, (err, result) => {
      if (!result) {
        logger.error(err);
        logger.error('failed to join network, will retry in 1 minute');
        callback(new Error('Failed to join network'));
      } else {
        callback(null, result);
      }
    });
  }

  node.listen(parseInt(config.NodeListenPort), () => {
    logger.info('dusk node is running! your identity is:');
    logger.info('');
    logger.info('');
    const identBundle = dusk.utils.getContactURL([node.identity, node.contact]); 
    logger.info(identBundle);
    logger.info('');
    logger.info('');
    fs.writeFileSync(
      path.join(program.datadir, 'dusk.pub'),
      identBundle
    );
    
    registerControlInterface();
    async.retry({
      times: Infinity,
      interval: 60000
    }, done => joinNetwork(done), (err, entry) => {
      if (err) {
        logger.error(err.message);
        process.exit(1);
      }

      logger.info(`connected to network via ${entry}`);
      logger.info(`discovered ${node.router.size} peers from seed`);
    });
  });
}

// Check if we are sending a command to a running daemon's controller
if (program.rpc || program.repl) {
  assert(!(parseInt(config.ControlPortEnabled) &&
           parseInt(config.ControlSockEnabled)),
    'ControlSock and ControlPort cannot both be enabled');

  const client = new boscar.Client();

  if (parseInt(config.ControlPortEnabled)) {
    client.connect(parseInt(config.ControlPort));
  } else if (parseInt(config.ControlSockEnabled)) {
    client.connect(config.ControlSock);
  }

  client.on('ready', () => {
    if (program.rpc === true || program.repl) {
      if (program.rpc) {
        logger.warn('no command provided to --rpc, starting repl');
      }
      return setTimeout(() => _initRepl(), 100);
    }

    const [method, ...params] = program.rpc.trim().split(' ');
    console.log(`(dusk:rpc) <~ ${method}(${params.join(' , ')})`);
    client.invoke(method, params, function(err, ...results) {
      if (err) {
        console.error(`(dusk:rpc) ~> ${err.message}`);
        process.exit(1);
      } else {
        console.info('(dusk:rpc) ~>');
        console.dir(results, { depth: null });
        process.exit(0);
      }
    });
  });

  client.socket.on('close', () => {
    console.error('Connection terminated! :(');
    process.exit(1);
  });

  client.on('error', err => {
    console.error(err);
    process.exit(1)
  });

  function _initRepl() {
    console.log('hi ♥');
    console.log('?? try: help\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '(dusk:repl) ~ ',
    });

    rl.prompt();

    rl.on('line', (line) => {
      if (!line) {
        return rl.prompt();
      }

      if (line === 'quit' || line === 'exit') {
        console.log('bye ♥ ');
        process.exit(0);
      }

      const [method, ...params] = line.trim().split(' ');
      client.invoke(method, params, function(err, ...results) {
        if (err) {
          console.error(err.message);
        } else {
          console.dir(results, { depth: null });
        }
      
        rl.prompt();
      });
    }).on('close', () => {
      console.log('bye ♥ ');
      process.exit(0);
    });
  }
} else if (program.F) {
  const tail = spawn('tail', ['-f', config.LogFilePath]);
  tail.stdout.pipe(prettyPrint.stdin).pipe(process.stdout);
} else {
  // Otherwise, kick everything off
  _init();
}
