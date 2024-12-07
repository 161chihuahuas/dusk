#!/usr/bin/env sh
':' //; exec "$(command -v node || command -v nodejs)" "$0" "$@"

'use strict';

// Shutdown children cleanly on exit
process.on('exit', exitGracefully); 
process.on('SIGTERM', exitGracefully); 
process.on('SIGINT', exitGracefully);
process.on('uncaughtException', (err) => {
  try {
    npid.remove(config.DaemonPidFilePath);
  } catch (err) {
    console.warn(err.message);
  }
  console.warn(err.message);
  if (logger) {
    logger.error(err.message);
    logger.debug(err.stack);
  }
  process.exit(0);
});
process.on('unhandledRejection', (err) => {
  try {
    npid.remove(config.DaemonPidFilePath);
  } catch (err) {
    console.warn(err.message);
  }
  console.error(err);
  if (logger) {
    logger.error(err.message);
    logger.debug(err.stack);
  }
  process.exit(0);
});

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
const levelup = require('levelup');
const leveldown = require('leveldown');
const boscar = require('boscar');
const rc = require('rc');
const encoding = require('encoding-down');
const secp256k1 = require('secp256k1');
const readline = require('node:readline');
const bip39 = require('bip39');
const inquirer = require('inquirer');
const { splitSync } = require('node-split');
const shoes = require('./shoes.js');
const mkdirp = require('mkdirp');
const { tmpdir } = require('os');
const http = require('node:http');
const hsv3 = require('@tacticalchihuahua/granax/hsv3');

program.version(dusk.version.software);

const description = `
  🝰 dusk ${dusk.version.software}

  anti-©opyright, 2024 tactical chihuahua 
  licensed under the agpl 3

`;

program.description(description);

program.option('--config, -C <file>', 
  'path to a dusk configuration file',
  path.join(homedir(), '.config/dusk/dusk.ini'));

program.option('--datadir <path>', 
  'path to the default data directory',
  path.join(homedir(), '.config/dusk'));

program.option('--kill', 
  'sends the shutdown signal to the daemon');

program.option('--testnet', 
  'runs with reduced identity difficulty');

program.option('--daemon, -D', 
  'sends the dusk daemon to the background');

program.option('--quiet, -Q', 
  'silence terminal output that is not necessary');

program.option('--rpc [method] [params]', 
  'send a command to the daemon');

program.option('--repl', 
  'starts the interactive rpc console');

program.option('--control-port <port>', 
  'use with --repl / --rpc to set the control port to connect to');

program.option('--control-sock <path>', 
  'use with --repl / --rpc to set the control socket to connect to');

program.option('--logs, -F', 
  'tails the log file defined in the config');

program.option('--link [dref]', 
  'adds a startup seed if one is supplied, otherwise shows our dref');

program.option('--unlink <id>',
  'removes the given startup seed');

program.option('--export-secret', 
  'dumps the private identity key');

program.option('--export-recovery', 
  'dumps the bip39 recovery words');

program.option('--shred [message]', 
  'splits and pads message into uniform shards');

program.option('--retrace [bundle]', 
  're-assembles a dusk bundle created by --shred');

program.option('--ephemeral', 
  'use with --shred --encrypt to generate a one-time use identity key');

program.option('--encrypt [message]', 
  'encrypt a message for yourself');

program.option('--pubkey [hex_pubkey]', 
  'use with --encrypt to set target or alone to print your key');

program.option('--decrypt [message]', 
  'decrypts the message for yourself');

program.option('--file-in [path]', 
  'specify file path to read or be prompted');

program.option('--file-out [path]', 
  'specify file path to write or be prompted');

program.option('--with-secret <hex_secret>',
  'override the configured private key, use with --decrypt and --retrace');

program.option('--shoes', 
  'setup a dusk/SHOES USB or use with --retrace, --shred');

program.option('--usb', 
  'alias for --shoes');

program.option('--dht', 
  'use with --shred, --retrace to store/retrieve shards to/from network');

program.option('--test-hooks',
  'starts onion service that prints received hooks from subscribe() handlers');

program.parse(process.argv);

program.usb = program.usb || program.shoes;

let argv;
let privkey, identity, logger, controller, node, nonce, proof;
let config;

function _setup() {
  return new Promise(async (resolve, reject) => {
    if (!program.Q) {
      console.log(description);
    }

    if (program.usb) {
      program.datadir = await shoes.mount();
    }

    if (program.datadir) {
      argv = { config: path.join(program.datadir, 'config') };
      program.config = argv.config;
    }

    if (program.testnet) {
      process.env.dusk_TestNetworkEnabled = '1';
    }


    config = rc('dusk', options(program.datadir), argv);

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

    resolve();
  });
}

async function _init() {
  // import es modules
  const fileSelector = (await import('inquirer-file-selector')).default;
  // import es modules
  
  await _setup();

  if (parseInt(config.TestNetworkEnabled)) {
    logger.info('dusk is running in test mode, difficulties are reduced');
    process.env.dusk_TestNetworkEnabled = config.TestNetworkEnabled;
    dusk.constants.IDENTITY_DIFFICULTY = dusk.constants.TESTNET_DIFFICULTY;
  }

  // Generate a private extended key if it does not exist
  if (!program.withSecret && !program.ephemeral && !fs.existsSync(config.PrivateKeyPath)) {
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

  You can also write down all but a few you can remember, 

  I'll trust your judgement.
  
  If you lose these words, you can never recover access 
  to this identity, including any data encrypted for 
  your secret key.

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

  if (program.kill) {
    try {
      const pid = fs.readFileSync(config.DaemonPidFilePath).toString().trim()
      console.log(`  [ shutting down dusk process with id: ${pid} ]`);
      process.kill(parseInt(pid), 'SIGTERM');
      console.log(`  [ done ♥ ]`);
    } catch (err) {
      console.error('I couldn\'t shutdown the daemon, is it running?');
      process.exit(1);
    }
    process.exit(0);
  }

  if (program.link === true) {  
    let pubbundle

    try {
      pubbundle = fs.readFileSync(config.DrefLinkPath).toString();
    } catch (e) {
      console.error('I couldn\'t find a dref link file, have you run dusk yet?');
      process.exit(1);
    }

    if (program.Q) {
      console.log(pubbundle);
    } else {
      console.log('public dusk link ♥ ~ [  %s  ] ', pubbundle);
    }
    process.exit(0);
  }

  if (program.shred) { 
    console.log('');
    
    let publicKey = program.pubkey || 
      fs.readFileSync(config.PublicKeyPath).toString('hex');

    let entry;

    if (typeof program.shred === 'string') {
      entry = Buffer.from(program.shred, 'hex');
    } else if (typeof program.fileIn === 'string') {
      entry = fs.readFileSync(program.fileIn);
    } else {
      program.fileIn = await fileSelector({
        message: 'Select input file:'
      });
      entry = fs.readFileSync(program.fileIn);
    }


    console.log('  encrypting input...');
    const encryptedFile = dusk.utils.encrypt(publicKey, entry);
    console.log('  shredding input and normalizing shard sizes...');
    console.log('  creating parity shards...');
    console.log('');
    const dagEntry = await dusk.DAGEntry.fromBuffer(encryptedFile, entry.length);

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
        program.fileOut = `${program.fileIn}.duskbundle`;
      } else {
        console.warn('you didn\'t specify a --file-out so i wont\'t write anything');
      }
    }  
    
    if (program.fileOut) {
      if (program.usb) {
        program.fileOut = path.join(
          program.datadir,
          'shoes.meta',
          `${Date.now()}-${path.basename(program.fileOut)}`
        );
      } else if (program.dht) {
        program.fileOut = path.join(
          program.datadir,
          'dusk.meta',
          `${Date.now()}-${path.basename(program.fileOut)}`
        );
      } else {
        program.fileOut = `${Date.now()}-${program.fileOut}`;
      }
      mkdirp.sync(program.fileOut);
    }

    if (fs.existsSync(program.fileOut) && fs.readdirSync(program.fileOut).length) {
      console.error('file %s already exists, i won\'t overwrite it', program.fileOut);
      process.exit(1);
    }

    const meta = dagEntry.toMetadata(`${Date.now()}-${program.fileIn}` || '');
    const metaEnc = dusk.utils.encrypt(publicKey, meta);
    const metaHash160 = dusk.utils.hash160(metaEnc).toString('hex');

    if (program.fileOut) {
      fs.writeFileSync(path.join(program.fileOut, 
        `${metaHash160}.meta`), 
        metaEnc
      );
    }

    if (program.usb) { 
      console.log('');
      await shoes.shred(dagEntry);
    } else if (program.dht) {
      console.log('');
      console.log('  ok, I\'m going to try to connect to dusk\'s control socket...');
      const rpc = await getRpcControl();
      console.log('');
      console.log('  [ we\'re connected ♥ ]')
      console.log('');
      console.log(`  I will attempt to store ${dagEntry.shards.length} shards in the DHT.`);
      console.log('  This can take a while depending on network conditions and the');
      console.log('  overall size of the file.');
      console.log('');
      console.log('  Make sure you are safe to sit here for a moment and babysit me.');
      console.log('  We will do 512Kib at a time, until we are done.');
      console.log('');
      
      let ready = false;

      while (!ready) {
        let answers = await inquirer.default.prompt({
          type: 'confirm',
          name: 'ready',
          message: 'Ready?'
        });
        ready = answers.ready;
      }

      console.log('');
      function store(hexValue) {
        return new Promise((resolve, reject) => {
          rpc.invoke('storevalue', [hexValue], (err) => {
            if (err) {
              return reject(err);
            }
            resolve(true);
          });
        });
      }

      for (let i = 0; i < dagEntry.shards.length; i++) {
        let success;
        console.log('  storevalue [  %s  ]', dagEntry.merkle._leaves[i].toString('hex'));
        while (!success) {
          try {
            success = await store(dagEntry.shards[i].toString('hex'));
            console.log('  [  done!  ]');
          } catch (e) {
            console.error(e.message);
            console.log('');
            let tryAgain = await inquirer.default.prompt({
              type: 'confirm',
              name: 'yes',
              message: 'Would you like to try again? If not I will exit.'
            });
            if (!tryAgain.yes) {
              process.exit(1);
            }
          }
        }
      }

      console.log('  [  we did it ♥  ]');
      console.log('');
    } else { 
      for (let s = 0; s < dagEntry.shards.length; s++) {
        if (program.fileOut) {
          fs.writeFileSync(path.join(
            program.fileOut, 
            `${dagEntry.merkle._leaves[s].toString('hex')}.part`
          ), dagEntry.shards[s]);
        }
      }
    }

    if (!program.Q) {
      if (program.fileOut) {
        console.log('');
        if (program.usb) {
          console.log('sneakernet created ~ be safe  ♥ ');
        } else {
          console.log('bundle written ♥ ~ [  %s  ] ', program.fileOut);
        }
        console.log('meta hash ♥ ~ [  %s  ] ', metaHash160);
        console.log('');
      } else {
        console.log('');
        console.warn('when you\'re ready, try again with --file-in / --file-out');
        console.log('');
      }
    }
    process.exit(0);
  }  

  // Initialize private key
  privkey = await (new Promise(async (resolve, reject) => {
    if (program.withSecret && dusk.utils.isHexaString(program.withSecret)) {
      return resolve(Buffer.from(program.withSecret, 'hex'));
    }

    if (program.ephemeral) {
      console.log('  You passed --ephemeral, your private key will not be saved');
      program.datadir = path.join(tmpdir(), 'dusk-' + Date.now());
      return resolve(dusk.utils.generatePrivateKey());
    }

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

  // are we starting the daemon?
  if (program.D) {
    console.log('');
    console.log('  [ starting dusk in the background ♥  ]');
    require('daemon')({ cwd: process.cwd() });
  
    try {
      logger.info(`writing pid file to ${config.DaemonPidFilePath}`);
      npid.create(config.DaemonPidFilePath).removeOnExit();
    } catch (err) {
      console.error('Failed to create PID file, is dusk already running?');
      process.exit(1);
    }
  } 

  if (program.retrace) {
    if (typeof program.retrace !== 'string') {
      program.retrace = '';

      while (path.extname(program.retrace) !== '.duskbundle') {
        if (program.retrace) {
          console.error(`${program.retrace} is not a valid .duskbundle, try again...`)
        }
        
        let basePath;

        if (program.usb) {
          basePath = path.join(program.datadir, 'shoes.meta');
        } else if (program.dht) {
          basePath = path.join(program.datadir, 'dusk.meta');
        } else {
          basePath = process.cwd();
        }

        program.retrace = await fileSelector({
          type:'directory',
          basePath,
          message: 'Select .duskbundle:',
          filter: (stat) => {
            return path.extname(stat.name) === '.duskbundle' || stat.isDirectory();
          }
        });
      }
    }
      
    console.log(`  Validating .duskbundle ...`);

    if (path.extname(program.retrace) !== '.duskbundle') {
      console.error('  The path specified does not have a .duskbundle extension.');
      console.error('  Did you choose the right folder?');
      console.error('  If you renamed the folder, make sure it ends in .duskbundle');
      process.exit(1);
    }
    
    const bundleContents = fs.readdirSync(program.retrace); 
    const metaFiles = bundleContents.filter(f => path.extname(f) === '.meta');

    if (metaFiles.length > 1) {
      console.error('i found more than one meta file and don\'t know what to do');
      process.exit(1);
    } else if (metaFiles.length === 0) {
      console.error('missing a meta file, i don\'t know how to retrace this bundle');
      process.exit(1);
    }
    const metaPath = path.join(program.retrace, metaFiles.pop());
    const metaData = JSON.parse(dusk.utils.decrypt(
      privkey.toString('hex'),
      fs.readFileSync(metaPath)
    ).toString('utf8'));
    
    let missingPieces = 0;

    console.log('  read meta file successfully ♥ ');
    console.log('');
    console.log('  retracing from merkle leaves... ');

    let shards;
    
    if (program.usb) {
      shards = (await shoes.retrace(metaData)).map(part => {
        if (!part) {
          console.warn('missing part detected');
          missingPieces++;
        
          if (missingPieces > metaData.p) {
            console.error('too many missing shards to recover this file');
            process.exit(1);
          }  
        
          return Buffer.alloc(dusk.DAGEntry.INPUT_SIZE);
        }
        return part;
      });
    } else if (program.dht) {
      shards = [];
      console.log('');
      console.log('  ok, I\'m going to try to connect to dusk\'s control socket...');
      const rpc = await getRpcControl();
      console.log('');
      console.log('  [ we\'re connected ♥ ]')
      console.log('');
      console.log(`  I will attempt to find ${metaData.l.length} shards in the DHT.`);
      console.log('  This can take a while depending on network conditions and the');
      console.log('  overall size of the file.');
      console.log('');
      console.log('  Make sure you are safe to sit here for a moment and babysit me.');
      console.log('  We will do 512Kib at a time, until we are done.');
      console.log('');
      
      let ready = false;

      while (!ready) {
        let answers = await inquirer.default.prompt({
          type: 'confirm',
          name: 'ready',
          message: 'Ready?'
        });
        ready = answers.ready;
      }

      console.log('');
      function findvalue(hexKey) {
        return new Promise((resolve, reject) => {
          rpc.invoke('findvalue', [hexKey], (err, data) => {
            if (err) {
              return reject(err);
            }
            if (data.length && data.length > 1) {
              return reject(new Error('Could not find shard.'));
            }
            resolve(Buffer.from(data.value, 'hex'));
          });
        });
      }

      for (let i = 0; i < metaData.l.length; i++) {
        let success;
        console.log('  findvalue [  %s  ]', metaData.l[i].toString('hex'));
        while (!success) {
          try {
            let shard = await findvalue(metaData.l[i].toString('hex'));
            console.log('  [  done!  ]');
            shards.push(shard);
            success = true;
          } catch (e) {
            console.error(e.message);
            console.log('');
            let tryAgain = await inquirer.default.prompt({
              type: 'confirm',
              name: 'yes',
              message: 'Would you like to try again? If not I will skip it.'
            });
            if (!tryAgain.yes) {
              missingPieces++;
              
              if (missingPieces > metaData.p) {
                console.error('too many missing shards to recover this file');
                process.exit(1);
              }

              shards.push(Buffer.alloc(dusk.DAGEntry.INPUT_SIZE));
              console.log('  [  skip.  ]');
              success = true;
            }
          }
        }
      }

      console.log('');
      console.log('  [  we did it ♥  ]');
      console.log('');
    } else {
      shards = metaData.l.map(hash => {
        console.log(`  reconstructing  [ ${hash}`);
        if (!fs.existsSync(path.join(program.retrace, `${hash}.part`))) {
          console.warn('missing part detected for hash %s', hash);
          missingPieces++;

          if (missingPieces > metaData.p) {
            console.error('too many missing shards to recover this file');
            process.exit(1);
          }

          return Buffer.alloc(dusk.DAGEntry.INPUT_SIZE);
        }
        return fs.readFileSync(path.join(program.retrace, `${hash}.part`));
      });
    }

    console.log('');
    console.log('  [ I reconstructed the encrypted and erasure coded buffer ♥ ]');
    console.log('');
    
    if (missingPieces) {
      console.log('  attempting to encode missing parts from erasure codes...')
      shards = splitSync(await dusk.reedsol.encodeCorrupted(splitSync(Buffer.concat(shards), {
        bytes: dusk.DAGEntry.INPUT_SIZE
      })), { bytes: dusk.DAGEntry.INPUT_SIZE });
    } 

    while (metaData.p--) {
      shards.pop();
    }

    if (program.usb) {
      console.log('  USER 0, I\'m ready to finish retracing and save to');
      console.log('  your dusk/SHOES USB.');
      console.log('');
      program.datadir = await shoes.mount();
    }

    const mergedNormalized = Buffer.concat(shards).subarray(0, metaData.s.a);
    const [unbundledFilename] = program.retrace.split('.duskbundle');
    const dirname = path.dirname(program.usb ? program.datadir : unbundledFilename);
    const filename = path.join(dirname, `unbundled-${Date.now()}-${path.basename(unbundledFilename)}`);
    const decryptedFile = dusk.utils.decrypt(privkey.toString('hex'), mergedNormalized);
    const fileBuf = Buffer.from(decryptedFile);
    const trimmedFile = fileBuf.subarray(0, metaData.s.o);

    if (fs.existsSync(filename)) {
      console.error(`${filename} already exists, I won't overwrite it.`);
      process.exit(1);
    }

    fs.writeFileSync(filename, trimmedFile);
    console.log('');
    console.log(`  [ File retraced successfully ♥ ]`);
    console.log(`  [ I saved it to ${filename} ♥ ]`);
    console.log('');
    process.exit(0);
  }
 
  if (program.exportSecret) {
    if (program.Q) {
      console.log(privkey.toString('hex'));
    } else {
      console.log('secret key ♥ ~ [  %s  ] ', privkey.toString('hex'));
    }
    process.exit(0);
  }

  if (program.exportRecovery) {
    if (program.Q) {
      console.log(bip39.entropyToMnemonic(privkey.toString('hex')));
    } else {
      console.log('recovery words ♥ ~ [  %s  ] ', bip39.entropyToMnemonic(privkey.toString('hex')));
    }
    process.exit(0);
  }
  let pubkey = Buffer.from(secp256k1.publicKeyCreate(privkey)).toString('hex');

  if (program.encrypt) {
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

    if (!Buffer.isBuffer(program.pubkey)) {
      if (typeof program.pubkey === 'string') {
        pubkey = program.pubkey;
      } else {
        pubkey = Buffer.from(secp256k1.publicKeyCreate(privkey)).toString('hex');
      }
    }

    if (program.fileIn) {
      program.encrypt = fs.readFileSync(program.fileIn);
    } else if (!dusk.utils.isHexaString(program.encrypt)) {
      console.error('String arguments to --encrypt [message] must be hexidecimal');
      program.encrypt = Buffer.from(program.encrypt, 'hex');
      process.exit(1);
    }

    let ciphertext = dusk.utils.encrypt(pubkey, program.encrypt);
    
    if (program.fileOut) {
      if (fs.existsSync(program.fileOut)) {
        console.error('file already exists, i won\'t overwrite it');
        process.exit(1);
      }
      fs.writeFileSync(program.fileOut, ciphertext);
      console.log('encrypted ♥ ~ [  file: %s  ] ', program.fileOut);
    } else if (!program.Q) {
      console.log('encrypted ♥ ~ [  %s  ] ', ciphertext.toString('hex'));
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
    let cleartext;
    if (program.decrypt === true && !program.fileIn) {
      console.error('i don\'t know what to decrypt this because no parameter was ');
      console.error('given to --decrypt and --file-in was not specified ');
      process.exit(1);
    }

    if (typeof program.decrypt === 'string') {
      if (program.fileIn) {
        console.error('i don\'t know what to decrypt because you passed a string to ');
        console.error('--decrypt but also specified --file-in');
        process.exit(1);
      }
      cleartext = dusk.utils.decrypt(privkey.toString('hex'), Buffer.from(program.decrypt, 'hex'));
    } else {
      const filepath = typeof program.fileIn === 'string' ?
        program.fileIn :
        await fileSelector({ message: 'Select file to decrypt' });
      try {
        cleartext = dusk.utils.decrypt(privkey.toString('hex'), 
          fs.readFileSync(filepath));
      } catch (err) {
        console.error(err.message);
        process.exit(1);
      }
    }

    if (!program.Q) {
      console.log('decrypted ♥ ~ [  %s  ] ', cleartext);
    } else {
      console.log(cleartext);
    }
    process.exit(0);
  }
 
  // If identity is not solved yet, start trying to solve it
  let identityHasValidProof = false;

  console.log(`  proof difficulty param [ N=${dusk.constants.IDENTITY_DIFFICULTY.n} ]`);
  console.log(`  proof difficulty param [ K=${dusk.constants.IDENTITY_DIFFICULTY.k} ]`);

  try {
    identityHasValidProof = await identity.validate();
  } catch (err) {
    console.warn(`Identity validation failed, ${err.message}`);
  }

  if (!identityHasValidProof) {
    console.log(`  identity proof not yet solved, this will take a moment...`);
    await identity.solve();
    fs.writeFileSync(config.IdentityNoncePath, identity.nonce.toString());
    fs.writeFileSync(config.IdentityProofPath, identity.proof);
    console.log('');
    console.log('  [  identity solution found ♥  ]');
  }
  console.log('');
  console.log(`  pubkey [ ${identity.pubkey.toString('hex')} ]`);
  console.log(`  proof [ ${identity.proof.toString('hex')} ]`);
  console.log(`  nonce [ ${identity.nonce} ]`);
  console.log(`  fingerprint [ ${identity.fingerprint.toString('hex')} ]`);

  if (program.usb) {
    console.log('');
    await shoes.init(program, config, privkey, identity);
    console.log('\n  [ created dusk/SHOES USB ♥ ] ');
    process.exit(0);
  } else {
    initDusk();
  }
}

function exitGracefully() {
  try {
    npid.remove(config.DaemonPidFilePath);
  } catch (e) {
    
  }

  process.removeListener('exit', exitGracefully);

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

async function initDusk() {
  console.log('\n  starting dusk ♥ ');

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

    // TODO read from datadir/seeds
    const seedsdir = path.join(program.datadir, 'seeds');

    if (!fs.existsSync(seedsdir)) {
      mkdirp.sync(seedsdir);
    }
    peers = peers.concat(fs.readdirSync(seedsdir).map(fs.readFile).map(buf => {
      return buf.toString();
    }));

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
      config.DrefLinkPath,
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

function getRpcControl() {
  return new Promise((resolve, reject) => {
    config = config || rc('dusk', options(program.datadir), argv);
    
    if (program.controlPort) {
      config.ControlPort = program.controlPort;
      config.ControlPortEnabled = '1';
      config.ControlSockEnabled = '0';
    }

    if (program.controlSock) {
      config.ControlSock = program.controlSock;
      config.ControlSockEnabled = '1';
      config.ControlPortEnabled = '0';
    }

    try {
      assert(!(parseInt(config.ControlPortEnabled) &&
               parseInt(config.ControlSockEnabled)),
        'ControlSock and ControlPort cannot both be enabled');
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }

    const client = new boscar.Client();

    if (parseInt(config.ControlPortEnabled)) {
      client.connect(parseInt(config.ControlPort));
    } else if (parseInt(config.ControlSockEnabled)) {
      client.connect(config.ControlSock);
    }

    client.on('ready', () => resolve(client));

    client.socket.on('close', () => {
      console.error('Connection terminated! :(');
      process.exit(1);
    });

    client.on('error', err => {
      console.error(err);
      process.exit(1)
    });
  });
}

// Check if we are sending a command to a running daemon's controller
if (program.rpc || program.repl) {
  rpcRepl();

  async function rpcRepl() {
    const client = await getRpcControl();

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
  }
} else if (program.F) {
  const tail = spawn('tail', ['-f', config.LogFilePath]);
  tail.stdout.pipe(prettyPrint.stdin).pipe(process.stdout);
} else if (program.testHooks) {
  console.log(description);
  console.log('');
  console.log('  I\'m setting up a local web server and onion service...')
  // Start a simple onion service that prints received requests
  // not for production use - ONLY for testing subscribe() hooks
  const dataDirectory = path.join(tmpdir(), 'dusk-hook-test-' + Date.now());
  const server = http.createServer((request, response) => {
    let body = '';
    request
      .on('error', console.error)
      .on('data', data => body += data.toString())
      .on('end', () => {
        try {
          body = JSON.parse(body);
          console.log('  [  hook received  ]', body);
        } catch (e) {
          console.error('Failed to parse content', e.message);
        }
        response.end();
      });
  });
  server.listen(0, () => {
    const localPort = server.address().port;
    const tor = hsv3([
      {
        dataDirectory: path.join(dataDirectory, 'hidden_service'),
        virtualPort: 80,
        localMapping: '127.0.0.1:' + localPort
      }
    ], {
      DataDirectory: dataDirectory
    });

    tor.on('error', (err) => {
      console.error(err);
      process.exit(1);
    });

    tor.on('ready', () => {
      console.log('');
      console.log('  [  dusk hook listener created  ♥  ]');
      console.log('  [  %s  ]',
        fs.readFileSync(path.join(dataDirectory, 'hidden_service',
          'hostname')).toString().trim());
      console.log('');
      console.log('  Hooks will print here when they are received.');
      console.log('');
    });
  });
} else if (typeof program.link === 'string') {
  console.log(description);
  try {
    const [id, contact] = dusk.utils.parseContactURL(program.link);
    const seedsdir = path.join(program.datadir, 'seeds');

    console.log('  saving seed to %s', seedsdir);
    console.log('  i will connect to this node on startup');
    fs.writeFileSync(path.join(seedsdir, id), program.link);
    console.log('');
    console.log('  [  done ♥  ]')
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
} else if (program.unlink) {
  console.log(description);
  try {
    const seedsdir = path.join(program.datadir, 'seeds');

    console.log('  removing %s from %s', program.unlink, seedsdir);
    console.log('');
    console.log('  i will not connect to this node on startup');
    fs.unlinkSync(path.join(seedsdir, program.unlink));
    console.log('');
    console.log('  [  done ♥  ]')
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

} else {
  // Otherwise, kick everything off
  _init();
}
