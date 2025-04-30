#!/usr/bin/env sh
':' //; exec "$(command -v node || command -v nodejs)" "$0" "$@"

'use strict';

// Shutdown children cleanly on exit
process.on('exit', exitGracefully); 
process.on('SIGTERM', exitGracefully); 
process.on('SIGINT', exitGracefully);

process.on('uncaughtException', (err) => {
  try {
    //npid.remove(config.DaemonPidFilePath);
  } catch (err) {
    console.warn(err.message);
  }
  console.error(err);
  if (logger) {
    logger.error(err.message);
    logger.debug(err.stack);
  }
  showUserCrashReport(err);
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  try {
    //npid.remove(config.DaemonPidFilePath);
  } catch (err) {
    console.warn(err.message);
  }
  console.error(err);
  if (logger) {
    logger.error(err.message);
    logger.debug(err.stack);
  }
  showUserCrashReport(err);
  process.exit(0);
});

const { fork, spawn, execSync } = require('node:child_process');
const assert = require('node:assert');
const async = require('async');
const split = require('split');
const qrcode = require('qrcode');
const program = require('commander');
const dusk = require('../index');
const bunyan = require('bunyan');
const RotatingLogStream = require('bunyan-rotating-file-stream');
const fs = require('node:fs');
const fsP = require('node:fs/promises');
const path = require('node:path');
const options = require('./config');
const npid = require('npid');
const levelup = require('levelup');
const leveldown = require('leveldown');
const boscar = require('boscar');
const rc = require('rc');
const encoding = require('encoding-down');
const secp256k1 = require('secp256k1');
const osascript = require('osascript');
const readline = require('node:readline');
const bip39 = require('bip39');
const inquirer = require('inquirer');
const { splitSync } = require('node-split');
const shoes = require('./shoes.js');
const mkdirp = require('mkdirp');
const zlib = require('node:zlib');
const { tmpdir, homedir, platform } = require('node:os');
const http = require('node:http');
const webdav = require('webdav-server').v2;
const hsv3 = require('@tacticalchihuahua/granax/hsv3');
const Dialog = require('../lib/zenity.js');
const { 
  uniqueNamesGenerator, 
  adjectives, 
  colors, 
  animals 
} = require('unique-names-generator');
const { randomBytes } = require('node:crypto');

const shoesTitle = '🝰 dusk / SHOES '
const duskTitle = '🝰 dusk'

function _open(args) {
  if (platform() === 'darwin') {
    return spawn('open', args, opts);
  } else {
    return spawn('xdg-open', args, opts);
  }
}

function _dusk(args, opts) {
  return fork(path.join(__dirname, 'dusk.js'), args, opts);
}

program.version(dusk.version.software);

const description = `
  🝰 dusk ${dusk.version.software}

  anti-©opyright, 2024 tactical chihuahua 
  licensed under the agpl 3

`;

program.description(description);

program.option('--config, -C <file>', 
  'path to a dusk configuration file',
  path.join(homedir(), '.config/dusk/config'));

program.option('--datadir <path>', 
  'path to the default data directory',
  path.join(homedir(), '.config/dusk'));

program.option('--setup', 
  'runs initial configuration only then exits (does not connect to network)');

program.option('--kill', 
  'sends the shutdown signal to the daemon');

program.option('--shutdown', 
  'alias for --kill');

program.option('--reset', 
  'restores the default configuration');

program.option('--destroy', 
  'prompts to shutdown dusk and deletes the entire data directory');

program.option('--testnet', 
  'runs with reduced identity difficulty');

program.option('--menu, -I [submenu]',
  'prompt user with interactive menu (default: text / graphical with --gui)');

program.option('--parse-url <url>', // TODO
  'attempts to parse the supplied url string and show details');

program.option('--resolve, -R <url>', // TODO
  'attempts to handle the given dusk url and open it in the appropriate interface');

program.option('--explore, -X [url]', // TODO
  'opens the explorer interface, use --gui for graphical');

program.option('--daemon, -D', 
  'sends the dusk daemon to the background');

program.option('--background', 
  'alias for --daemon, -D');

program.option('--restart', 
  'gracefully shuts down dusk and restarts it in the background');

program.option('--quiet, -Q', 
  'silence terminal output that is not necessary');

program.option('--gui',
  'prompt with graphical dialogs instead of command line prompts');

program.option('--install',
  'writes linux .desktop entry to $HOME/.local/share/applications');

program.option('--uninstall',
  'deletes linux .desktop entry from $HOME/.local/share/applications');

program.option('--update',
  'checks if a newer version is available, installs it, and restarts dusk');

program.option('--enable-autostart',
  'adds linux .desktop entry to $HOME/.config/autostart');

program.option('--disable-autostart',
  'removes linux .desktop entry from $HOME/.config/autostart');

program.option('--rpc [method] [params]', 
  'send a command to the daemon');

program.option('--repl', 
  'starts the interactive rpc console');

program.option('--control-port <port>', 
  'use with --repl / --rpc to set the control port to connect to');

program.option('--control-sock <path>', 
  'use with --repl / --rpc to set the control socket to connect to');

program.option('--logs, -F [num_lines]', 
  'tails the log file defined in the config');

program.option('--show-links', 
  'shows a list of saved startup seeds / linked devices')

program.option('--link [dref]', 
  'adds a startup seed / device link');

program.option('--unlink [id_or_shortname]',
  'removes the given startup seed');

program.option('--export-link', 
  'shows our shareable device link');

program.option('--export-secret', 
  'dumps the private identity key');

program.option('--import-secret [hex_secret]', 
  'overwrites the private identity key (will confirm)');

program.option('--export-recovery', 
  'dumps the bip39 recovery words');

program.option('--import-recovery [comma_sep_words]', 
  'recovers a private ientity key from words and overwrites it (will confirm)');

program.option('--shred [message]', 
  'splits and pads message into uniform shards');

program.option('--retrace [bundle]', 
  're-assembles a dusk bundle created by --shred');

program.option('--vfs',
  'use with --shred or --retrace to operate on the virtual filesystem');

program.option('--open', 'runs xdg-open/open on things when possible');

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

program.option('--with-secret [hex_secret]',
  'override the configured private key, use with --decrypt and --retrace');

program.option('--webdav-pass <password>',
  'set the webdav root user password for this session');

program.option('--shoes', 
  'setup a dusk/SHOES USB or use with --retrace, --shred');
program.option('--usb', 'alias for --shoes');

program.option('--dht', 
  'use with --shred, --retrace to store/retrieve shards to/from network');

program.option('--lazy', 
  'store entries in the local database for later replication');

program.option('--local', 
  'use with --shred, --retrace to store/retrieve shards to/from local database');

program.option('--test-hooks',
  'starts onion service that prints received hooks from subscribe() handlers');

program.option('--yes',
  'automatically confirm all y/n prompts');

program.parse(process.argv);

program.usb = program.usb || program.shoes;


let argv;
let privkey, identity, logger, controller, node, nonce, proof;
let config;

let _didSetup = false;

function _update() {
  return new Promise((resolve) => {
    let progress;
    if (program.gui) {
      progress = Dialog.progress('Updating to latest version, hang tight ♥ ...', '🝰 dusk', {
        pulsate: true,
        noCancel: true
      });
    } else {
      console.log('  Updating 🝰 dusk, this can take a moment ...');
    }
    try {
      execSync('curl -o- https://rundusk.org/install.sh | bash');
    } catch (e) {
      if (!program.gui) {
        console.error('  Failed to update:', e.message);
      } else {
        progress.progress(100);
      }
      resolve();
    }
    if (!program.restart) {
      exitGracefully();
    }
  });
}

if (program.update) {
  _update();
}

function installMacBundle() {
  const binpath = execSync('which node').toString().trim();
  const localAppDir = path.join(homedir(), 'Applications');
  const appDir = path.join(localAppDir, 'dusk.app');
  const bundlePaths = [
    'Contents/MacOS',
    'Contents/Resources'
  ];
  console.log('  Creating app bundle...');
  console.log(`  ${localAppDir}`);
  console.log(`  ${appDir}`);
  fs.mkdirSync(localAppDir, { recursive: true });
  fs.mkdirSync(appDir, { recursive: true });
  bundlePaths.forEach(p => {
    console.log(`  ${appDir}/${p}`);
    fs.mkdirSync(path.join(appDir, p), { recursive: true });
  });
  const icnsPath = path.join(__dirname, '../assets/images/icon-dusk.icns');
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>wrapper</string>
  <key>CFBundleIdentifier</key>
  <string>org.rundusk.app</string>
  <key>CFBundleName</key>
  <string>dusk</string>
  <key>CFBundleVersion</key>
  <string>${dusk.version.software}</string>
  <key>CFBundleIconFile</key>
  <string>dusk.icns</string>
</dict>
</plist>`;
  const plistPath = path.join(appDir, 'Contents/Info.plist');
  const iconPath = path.join(appDir, 'Contents/Resources/dusk.icns');
  const wrapperPath = path.join(appDir, 'Contents/MacOS/wrapper');
  const wrapperContent = `#!/bin/sh
script_path="$(dirname "$0")"/dusk
open -a Terminal "$script_path"`;
  const scriptPath = path.join(appDir, 'Contents/MacOS/dusk');
  const scriptContent = `#!/bin/sh
${binpath} ${path.join(__dirname)}/dusk.js --gui --menu`;
  console.log(`  ${plistPath}`);
  console.log(`  ${iconPath}`);
  console.log(`  ${wrapperPath}`);
  console.log(`  ${scriptPath}`);
  fs.writeFileSync(plistPath, plistContent);
  fs.writeFileSync(iconPath,fs.readFileSync(icnsPath));
  fs.writeFileSync(wrapperPath, wrapperContent);
  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(path.join(appDir, 'Contents/MacOS/dusk'), '777');
  fs.chmodSync(path.join(appDir, 'Contents/MacOS/wrapper'), '777');
  console.log('');
  console.log('  [ done! ♥ ]');
}

function uninstallMacBundle() {
  const localAppDir = path.join(homedir(), 'Applications');
  const appDir = path.join(localAppDir, 'dusk.app');
  console.log('  Removing ' + appDir);
  fs.rmSync(appDir, { recursive: true });
  console.log('');
  console.log('  [ done! ♥ ]');
}

function installGnomeDesktop() {
  const binpath = execSync('which node').toString().trim();
  const desktop1 = `[Desktop Entry]
Name=${duskTitle} ~ Files
Comment=deniable cloud drive file browser
Terminal=false
Exec=${binpath} ${path.join(__dirname)}/dusk.js --open --gui --menu %U
Icon=${path.join(__dirname, '../assets/images/icon-files.png')}
Categories=Utility;
Type=Application
  `;
  const desktop2 = `[Desktop Entry]
Name=${duskTitle} ~ Settings
Comment=deniable cloud drive
Terminal=false
Exec=${binpath} ${path.join(__dirname)}/dusk.js --gui --menu %U
Icon=${path.join(__dirname, '../assets/images/icon-settings.png')}
Categories=Utility;
Type=Application
  `;
  const writeOut1 = path.join(homedir(), '.local/share/applications/dusk_Files.desktop');
  const writeOut2 = path.join(homedir(), '.local/share/applications/dusk_Settings.desktop');
  console.log(`  Installing desktop entries to ${writeOut1},${writeOut2}...`);
  try {
    fs.writeFileSync(writeOut1, desktop1);
    fs.writeFileSync(writeOut2, desktop2);
  } catch (e) {
    console.error('  Failed to create desktop entries:', e.message);
    exitGracefully();
  }
  if (!program.enableAutostart) {
    console.log('');
    console.log('  [ done! ♥ ]');
    exitGracefully();
  }
}

function uninstallGnomeDesktop() {
  const writeOut1 = path.join(homedir(), '.local/share/applications/dusk_Files.desktop');
  const writeOut2 = path.join(homedir(), '.local/share/applications/dusk_Settings.desktop');
  console.log(`  Removing desktop entries from ${writeOut1},${writeOut2}...`);
  try {
    fs.unlinkSync(writeOut1);
    fs.unlinkSync(writeOut2);
  } catch (e) {
    console.error('  Failed to remove desktop entries:', e.message);
    exitGracefully();
  }
  if (!program.disableAutostart) {
    console.log('');
    console.log('  [ done! ♥ ]');
    exitGracefully();
  }
}

if (program.install) {
  if (platform() === 'linux') {
    installGnomeDesktop();
  } else if (platform() === 'darwin') {
    installMacBundle();
    exitGracefully();
  } else {
    throw new Error('Unsupported platform!');
  }
}

if (program.uninstall) {
  if (platform() === 'linux') {
    uninstallGnomeDesktop();
  } else if (platform() === 'darwin') {
    uninstallMacBundle();
    exitGracefully();
  } else {
    throw new Error('Unsupported platform!');
  }
}

function enableAutostartMac() {
  const binpath = execSync('which node').toString().trim();
  const plistFileContent = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "
    -//Apple//DTD PLIST 1.0//EN"
     "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>dusk
    </string><key>ProgramArguments</key><array><string>bash</string><string>-c</string>
    <string>${binpath} ${path.join(__dirname)}/dusk.js --background --gui
    </string></array><key>RunAtLoad</key><true/></dict></plist>`;

  const plistFileName = `${homedir()}/Library/LaunchAgents/dusk.plist`;
 
  console.log(`  Writing LaunchAgent to ${plistFileName}...`);

  if (!fs.existsSync(path.join(homedir(), 'Library/LaunchAgents'))) {
    fs.mkdirSync(path.join(homedir(), 'Library/LaunchAgents'));
  }
  fs.writeFileSync(plistFileName, plistFileContent);
}

function disableAutostartMac() {
  const plistFileName = `${homedir()}/Library/LaunchAgents/dusk.plist`;
  console.log(`  Removing LaunchAgent from ${plistFileName}...`);
  fs.unlinkSync(plistFileName);
}

function enableAutostartGnome() {
  const binpath = execSync('which node').toString().trim();
  const autostart1 = `[Desktop Entry]
Name=${duskTitle} ~ Connect
Comment=deniable cloud drive
Terminal=false
Exec=${binpath} ${path.join(__dirname)}/dusk.js --background --gui %U
Icon=${path.join(__dirname, '../assets/images/icon-dusk.png')}
Categories=Utility;
Type=Application
StartupNotify=false
X-GNOME-Autostart-enabled=true
X-GNOME-Autostart-Delay=1
  `;
  const writeOut3 = path.join(homedir(), '.config/autostart/dusk_Autostart.desktop');
  console.log(`  Adding autostart entry to ${writeOut3}...`);
  try {
    fs.writeFileSync(writeOut3, autostart1);
  } catch (e) {
    console.error('Failed to create autostart entry', e.message);
    exitGracefully();
  }
  console.log('');
  console.log('  [ done! ♥ ]');
  exitGracefully();
}

function disableAutostartGnome() {
  const writeOut3 = path.join(homedir(), '.config/autostart/dusk:Autostart.desktop');
  console.log(`  Removing autostart entry from ${writeOut3}...`);
  try {
    fs.unlinkSync(writeOut3);
  } catch (e) {
    console.error('  Failed to remove autostart entry:', e.message);
    exitGracefully();
  }
  console.log('');
  console.log('  [ done! ♥ ]');
  exitGracefully();
}

if (program.enableAutostart) {
  if (platform() === 'linux') {
    enableAutostartGnome();
  } else if (platform() === 'darwin') {
    enableAutostartMac();
    exitGracefully();
  } else {
    throw new Error('Unsupported platform!');
  }
}

if (program.disableAutostart) {
  if (platform() === 'linux') {
    disableAutostartGnome();
  } else if (platform() === 'darwin') {
    disableAutostartMac();
    exitGracefully();
  } else {
    throw new Error('Unsupported platform!');
  }
}

function _reset() {
  let areYouSure;
  const message = 'Reset dusk to default configuration? Your data will not be deleted.'

  return new Promise(async () => {
    if (!fs.existsSync(program.C)) {
      if (program.gui) {
        Dialog.info(`Configuration file ${program.C} does not exist`, 'Sorry', 'error');
      } else {
        console.error(`  Configuration file ${program.C} does not exist? Sorry.`);
      }
      exitGracefully();
    } 

    if (program.gui) {
      areYouSure = {
        yes: program.yes ||
          Dialog.info(message, 'Confirm', 'question').status !== 1
      };
    } else {
      areYouSure = program.yes ? { yes: true } : await inquirer.default.prompt({
        name: 'yes',
        type: 'confirm',
        message
      });
    }

    if (!areYouSure.yes) {
      console.log('  Ok, cancelled.');
      exitGracefully();
    }

    console.log(`  Removing ${program.C} to restore default configuration...`);
    fs.unlinkSync(program.C);
    console.log('');
    console.log('  [ done! ♥ ]');
    exitGracefully();
  });
}

function _destroy() {
  let areYouSure;
  const message = 'Completely reset dusk? You will lose everything!';

  return new Promise(async (resolve) => {
    if (!fs.existsSync(program.datadir)) {
      if (program.gui) {
        Dialog.info(`Data directory ${program.datadir} does not exist`, 'Sorry', 'error');
      } else {
        console.error(`  Data directory ${program.datadir} does not exist? Sorry.`);
      }
      exitGracefully();
    } 

    if (program.gui) {
      areYouSure = {
        yes: program.yes ||
          Dialog.info(message, 'Confirm', 'question').status !== 1
      };
    } else {
      areYouSure = program.yes ? { yes: true } : await inquirer.default.prompt({
        name: 'yes',
        type: 'confirm',
        message
      });
    }

    if (!areYouSure.yes) {
      console.log('  Ok, cancelled.');
      exitGracefully();
    }

    console.log(`  Removing ${program.datadir} ...`);
    await fsP.rm(program.datadir, { recursive: true });
    console.log('');
    console.log('  [ done! ♥ ]');
    program.shutdown = true;
    resolve()
  });
}
function _config() {
  if (program.datadir) {
    argv = { config: path.join(program.datadir, 'config') };
    program.config = argv.config;
  }

  config = rc('dusk', options(program.datadir), argv);
}

function _setup() {
  return new Promise(async (resolve, reject) => {
    if (!program.Q) {
      console.log(description);
    }

    if (program.usb) {
      program.datadir = await shoes.mount(program, config, exitGracefully);
    }

    if (program.testnet) {
      process.env.dusk_TestNetworkEnabled = '1';
    }

    _config();

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

    _didSetup = true;
    resolve();
  });
}

async function _init() {
  // import es modules
  const fileSelector = (await import('inquirer-file-selector')).default;
  // import es modules

  function _importRecovery() {
    return new Promise(async (resolve, reject) => {
      let words;

      if (typeof program.importRecovery !== 'string') {
        const questions = [{
          type: 'text',
          name: 'words',
          message: 'Enter the 24 word recovery phrase to import? ~>',
        }];
        const answers = program.gui
          ? { words: Dialog.entry('Enter the 24 word recovery phrase to import:', '🝰 dusk') }
          : await inquirer.default.prompt(questions);
      
        words = answers.words.split();
      } else {
        words = program.importRecovery.split();
      }

      let sk = bip39.mnemonicToEntropy(words.join(' '));
      program.importSecret = sk.toString('hex');

      resolve(sk);
    });
  }

  function _importSecret() {
    return new Promise(async (resolve, reject) => {
      if (program.importSecret === true) {
        const questions = [{
          type: 'password',
          name: 'secret',
          message: 'Enter the secret key to import? ~>',
        }];
        const answers = program.gui
          ? { secret: Dialog.entry('Enter the secret key to import:', '🝰 dusk') }
          : await inquirer.default.prompt(questions);

        program.importSecret = answers.secret;
      }

      if (typeof program.importSecret === 'string') {
        if (!dusk.utils.isHexaString(program.importSecret)) {
          return reject(new Error('Secret key must be hexidecimal'));
        }

        let sk = Buffer.from(program.importSecret, 'hex');

        if (!secp256k1.privateKeyVerify(sk)) {
          return reject(new Error('Invalid secret key'));
        }

        return resolve(sk);
      }
    });
  }

  if (program.reset) {
    await _reset();
  }

  if (!_didSetup) {
    await _setup();
  }

  if (!program.Q && !!parseInt(config.AlwaysPromptToUpdate)) {
    let shouldUpdate, shouldPrompt;
    const message = 'Would you like to check for updates?';

    try {
      shouldPrompt = (Date.now() - parseInt(fs.readFileSync(
        path.join(program.datadir, 'last_update_prompt')
      ))) >= 86400000;
    } catch (err) {
      shouldPrompt = true;
    } 

    if (shouldPrompt) {
      fs.writeFileSync(
        path.join(program.datadir, 'last_update_prompt'),
        Date.now().toString()
      );

      if (program.gui) {
        shouldUpdate = {
          yes: program.yes ||
            Dialog.info(message, '🝰 dusk', 'question').status !== 1
        };
      } else {
        shouldUpdate = program.yes ? { yes: true } : await inquirer.default.prompt({
          name: 'yes',
          type: 'confirm',
          message
        });
      }

      fs.writeFileSync(
        path.join(program.datadir, 'last_update_prompt'),
        Date.now().toString()
      );

      if (shouldUpdate.yes) {
        program.restart = true;
        await _update();
      }
    }
  }

  if (parseInt(config.TestNetworkEnabled)) {
    logger.info('dusk is running in test mode, difficulties are reduced');
    process.env.dusk_TestNetworkEnabled = config.TestNetworkEnabled;
    dusk.constants.IDENTITY_DIFFICULTY = dusk.constants.TESTNET_DIFFICULTY;
  }

  // Generate a private key if it does not exist
  const shouldPersistSecret = !program.withSecret && !program.ephemeral;
  const appearsFreshInstall = !fs.existsSync(config.PrivateKeyPath);
  const canPersistSecret = program.importRecovery || program.importSecret || appearsFreshInstall;

  if (program.importRecovery) {
    await _importRecovery();
  }

  const sk = program.importSecret 
    ? await _importSecret()
    : dusk.utils.generatePrivateKey();

  if (shouldPersistSecret && canPersistSecret) {
    const questions = [
      {
        type: 'password',
        name: 'password1',
        message: 'I have your key, enter a password to protect it? ~>',
      },
      {
        type: 'password',
        name: 'password2',
        message: 'Once more, to make sure? ♥ ~>'
      }
    ];

    let answers;
    
    const message = 'Your dusk key is stored encrypted on your device and' + 
      ' is used to protect your files. Next, I will ask you to set a password and then confirm it.';

    if (program.gui) {
      Dialog.info(message, 'info');
    } else {
      console.log(`
  ${message}
      `);
    }

    if (!program.gui) {
      answers = await inquirer.default.prompt(questions);
    } else {
      answers = {
        password1: Dialog.password('I have your key, enter a password to protect it?', duskTitle),
        password2: Dialog.password('Once more, to make sure? ♥', duskTitle)
      };

      if (!answers) {
        Dialog.info('You cancelled the setup. I will try again the next time you run dusk.', 'Error', 'error');
        process.exit(1);
      }
    } 

    if (answers.password1 !== answers.password2) {
      if (program.gui) {
        Dialog.info('Passwords did not match, try again?', 'Error', 'error');
        return _init();
      }
      logger.error('Passwords do not match, try again?');
      return _init();
    }

    if (answers.password1.trim() === '') {
      let ignore;
      const message = `You entered a blank password. Are you sure?`;

      if (program.gui) {
        ignore = {
          useBlankPassword: program.yes ||
            Dialog.info(message, 'Confirm', 'question').status !== 1
        };
      } else {
        ignore = program.yes ? { useBlankPassword: true } : await inquirer.default.prompt({
          name: 'useBlankPassword',
          type: 'confirm',
          message
        });
      }

      if (!ignore.useBlankPassword) {
        return _init(); 
      }
    }

    const salt = fs.existsSync(config.PrivateKeySaltPath)
      ? fs.readFileSync(config.PrivateKeySaltPath)
      : crypto.getRandomValues(Buffer.alloc(16));
    const encryptedPrivKey = dusk.utils.passwordProtect(answers.password1, salt, sk);
    
    let words = bip39.entropyToMnemonic(sk.toString('hex'));
    let wordlist = words.split(' ').map((word, i) => `${i+1}.  ${word}`);
    words = wordlist.join('\n');

    const text = `Your key is protected, don\'t forget your password! Write these words down, keep them safe. You can also write down all but a few you can remember, I'll trust your judgement.
  
If you lose these words, you can never recover access to this identity, including any data encrypted for your secret key`;

    let savedWords = false;
    
    if (program.gui) {
      Dialog.info(text, 'IMPORTANT', 'warning');
      savedWords = { 
        iPromise: program.yes || await Dialog.textInfo(words, 'Recovery Words', { 
          checkbox: 'I have written down my recovery words.' 
        }) === 0 
      };
    } else {
      console.warn(text);
      console.log(words);
      savedWords = program.yes ? { iPromise: true } : await inquirer.default.prompt({
        name: 'iPromise',
        type: 'confirm',
        message: 'I have written down my recovery words.'
      });
    }

    if (savedWords.iPromise) {
      if (!appearsFreshInstall) {
        const warningText = 'This operation will overwrite the current secret key!' + 
          'You will not be able to retrace snapshots for the previous key after importing this one.' +
          '\n\nContinue?';
        let iUnderstand;
          
        if (program.gui) {
          iUnderstand = { 
            iPromise: program.yes || await Dialog.info(warningText, 'IMPORTANT', 
              'question').status === 0 
          };
        } else {
          console.warn(warningText);
          iUnderstand = program.yes ? { iPromise: true } : await inquirer.default.prompt({
            name: 'iPromise',
            type: 'confirm',
            message: 'Continue?'
          });
        }

        if (!iUnderstand.iPromise) {
         const msg = 'I did not import your key and will exit.';
          if (program.gui) {
            Dialog.info(msg, duskTitle, 'error');
            exitGracefully();
          } else {
            console.error(msg);
            exitGracefully();;
          }  
        }
      } 

      fs.writeFileSync(config.PrivateKeySaltPath, salt);
      fs.writeFileSync(config.PrivateKeyPath, encryptedPrivKey);
      fs.writeFileSync(config.PublicKeyPath, secp256k1.publicKeyCreate(sk));

      // Let's not get stuck in a loop :]
      program.importSecret = false;
      program.importRecovery = false;
    } else {
      const msg = 'I did not save your key and will exit. Try again.';
      if (program.gui) {
        Dialog.info(msg, 'Error', 'error');
        process.exit(1);
      } else {
        console.error(msg);
        process.exit(1);
      }
    }
    return _init();
  }

  if (fs.existsSync(config.IdentityProofPath)) {
    proof = fs.readFileSync(config.IdentityProofPath);
  }

  if (fs.existsSync(config.IdentityNoncePath)) {
    nonce = parseInt(fs.readFileSync(config.IdentityNoncePath).toString());
  }

  program.kill = program.kill || program.shutdown || program.destroy || program.restart;

  async function _kill(dontExit) {
    try {
      const pid = fs.readFileSync(config.DaemonPidFilePath).toString().trim()
      console.log(`  [ shutting down dusk process with id: ${pid} ]`);
      process.kill(parseInt(pid), 'SIGTERM');
      console.log(`  [ done ♥ ]`);
      return true;
    } catch (err) {
      console.error(err);
      console.error('I couldn\'t shutdown the daemon, is it running?');
    }
    return false;
  }

  if (program.kill) {
    _kill()
    
    if (program.destroy) {
      await _destroy();
    }
  
    if (program.restart) {
      program.D = true;
    } else {
      exitGracefully();
    }
  }
    
  if (program.exportLink) {  
    let pubbundle

    try {
      pubbundle = fs.readFileSync(config.DrefLinkPath).toString();
    } catch (e) {
      console.error('I couldn\'t find a dref link file, have you run dusk yet?');
      process.exit(1);
    }

    if (program.gui) {
      Dialog.entry('Shareable device link:', '🝰 dusk', pubbundle);
    } else if (program.Q) {
      console.log(pubbundle);
    } else {
      console.log('public dusk link ♥ ~ [  %s  ] ', pubbundle);
    }
    process.exit(0);
  }

  if (program.shred) { 
    console.log('');

    if (program.vfs) {
      program.shred = true;
      program.fileIn = typeof program.vfs === 'string'
        ? program.vfs
        : config.VirtualFileSystemPath;
    }
    
    let publicKey = program.pubkey || 
      fs.readFileSync(config.PublicKeyPath).toString('hex');

    let entry;

    if (typeof program.shred === 'string') {
      entry = Buffer.from(program.shred, 'hex');
    } else if (typeof program.fileIn === 'string') {
      entry = fs.readFileSync(program.fileIn);
    } else if (program.gui) { 
      program.fileIn = Dialog.file('file', false, false);
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
        dagEntry.merkle.level(i).forEach(l => {
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
          'shoes',
          path.dirname(program.fileOut).split('shoes')[1],
          `${Date.now()}-${path.basename(program.fileOut)}`
        );
      } else {
        program.fileOut = path.join(
          config.MetadataDirectory,
          `${Date.now()}-${path.basename(program.fileOut)}`
        );
      }
      mkdirp.sync(program.fileOut);
    }

    if (fs.existsSync(program.fileOut) && fs.readdirSync(program.fileOut).length) {
      if (program.gui) {
        Dialog.info(`The file ${program.fileOut} already exists. I won't overwrite it`,
          'Sorry', 'error');
      }
      console.error('file %s already exists, i won\'t overwrite it', program.fileOut);
      process.exit(1);
    }

    const meta = dagEntry.toMetadata(`${Date.now()}-${path.basename(program.fileIn)}` || '');
    const metaEnc = dusk.utils.encrypt(publicKey, meta);
    const metaHash160 = dusk.utils.hash160(metaEnc).toString('hex');

    if (program.fileOut) {
      fs.writeFileSync(path.join(program.fileOut, 
        `${metaHash160}.meta`), 
        metaEnc
      );
    }

    let progressBar, rpc;
     
    if (program.usb) { 
      console.log('');
      await shoes.shred(dagEntry, program, config, exitGracefully);
    } else if (program.dht || program.local) {
      console.log('');
      console.log('  ok, I\'m going to try to connect to dusk\'s control socket...');
      rpc = await getRpcControl();
      console.log('');
      console.log('  [ we\'re connected ♥ ]')
      console.log('');
    }

    if (program.local || (program.dht && program.lazy)) {
      console.log(`  I will attempt to write ${dagEntry.shards.length} to my local database...`);
      
      function storeLocal(hexValue) {
        return new Promise((resolve, reject) => {
          rpc.invoke('putlocal', [hexValue], (err, key) => {
            if (err) {
              return reject(err);
            }
            resolve(key);
          });
        });
      }

      for (let i = 0; i < dagEntry.shards.length; i++) {
        let success;
        
        console.log('  putlocal [  %s  ]', dagEntry.merkle._leaves[i].toString('hex'));
        
        while (!success) {
          try {
            success = await storeLocal(dagEntry.shards[i].toString('hex'));
            console.log('  [  done!  ]');
          } catch (e) {
            console.error(e.message);
            console.log('');
            exitGracefully();
          }
        }
      }
    }

    if (program.dht) {
      console.log(`  I will attempt to store ${dagEntry.shards.length} shards in the DHT.`);
      console.log('  This can take a while depending on network conditions and the');
      console.log('  overall size of the file.');
      console.log('');
      console.log('  Make sure you are safe to sit here for a moment and babysit me.');
      console.log('  We will do ' + dusk.constants.SHARD_SIZE + 'bytes at a time, until we are done.');
      console.log('');
            
      let ready = false;

      if (program.gui) {
        ready = Dialog.info(
          `I connected to dusk's control port ♥ 

I will attempt to store ${dagEntry.shards.length} shards in the DHT. This can take a while depending on network conditions and the overall size of the file.

Make sure you are safe to sit here for a moment and babysit me. We will do ${dusk.constants.SHARD_SIZE}bytes at a time, until we are done.

Ready?
          `,
          '🝰 dusk',
          'question'
        );
      }

      while (!ready && !program.yes) {
        let answers = await inquirer.default.prompt({
          type: 'confirm',
          name: 'ready',
          message: 'Ready?'
        });
        ready = answers.ready;
      }

      console.log('');
      function storeNetwork(hexValue) {
        return new Promise((resolve, reject) => {
          rpc.invoke('storevalue', [hexValue], (err) => {
            if (err) {
              return reject(err);
            }
            resolve(true);
          });
        });
      }

      if (program.gui) {
        progressBar = Dialog.progress('Shredding file ♥ ...', '🝰 dusk', {
          pulsate: true,
          noCancel: true
        });
      }

      for (let i = 0; i < dagEntry.shards.length; i++) {
        let success;
        if (progressBar) {
          progressBar.progress((i / dagEntry.shards.length) * 100);
          progressBar.text('Storing piece ' + dagEntry.merkle._leaves[i].toString('hex') + '...');
        }
        console.log('  storevalue [  %s  ]', dagEntry.merkle._leaves[i].toString('hex'));
        while (!success) {
          try {
            success = await storeNetwork(dagEntry.shards[i].toString('hex'));
            console.log('  [  done!  ]');
          } catch (e) {
            let tryAgain = { yes: program.yes && !(program.local && program.lazy) };
            console.error(e.message);
            console.log('');
            if (program.gui && (!program.lazy && program.local)) {
              tryAgain = { yes: tryAgain.yes || Dialog.info(
                `I wasn't able to store the shard. Would you like to try again? If not, I will exit.`, 
                  '🝰 dusk', 'question') };
            } else if (!program.lazy && program.local) {
              tryAgain = tryAgain.yes ? { yes: true } : await inquirer.default.prompt({
                type: 'confirm',
                name: 'yes',
                message: 'Would you like to try again? If not I will exit.'
              });
            }
            if (!tryAgain.yes && !program.lazy) {
              process.exit(1);
            } else {
              success = true;
            }
          }
        }
      }
      
      if (program.gui) {
        Dialog.notify('File was stored in the dusk network', 'Success!');
      }

      console.log('  [  we did it ♥  ]');
      console.log('');
    } else { 
      for (let s = 0; s < dagEntry.shards.length; s++) {
        if (program.gui) {
          progressBar = Dialog.progress('Shredding file ♥ ...', '🝰 dusk', {
            pulsate: true,
            noCancel: true
          });
        }  
        if (progressBar) {
          progressBar.progress((s / dagEntry.shards.length) * 100);
        }
        if (program.fileOut) {
          fs.writeFileSync(path.join(
            program.fileOut, 
            `${dagEntry.merkle._leaves[s].toString('hex')}.part`
          ), dagEntry.shards[s]);
        }
      }
    }

    if (!program.Q) {
      if (progressBar) {
        progressBar.progress(100);
      }
      if (program.fileOut) {
        console.log('');
        if (program.usb) {
          if (program.gui) {
            Dialog.info('Sneakernet created! Be safe. ♥', '🝰 dusk / SHOES', 'info');
          }
          console.log('sneakernet created ~ be safe  ♥ ');
        } else {
          if (program.gui) {
            Dialog.info('Parts uploaded and metadata written to ' + program.fileOut, '🝰 dusk', 'info'); 
          }
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
    if (program.withSecret === true) {
      const questions = [{
        type: 'password',
        name: 'secret',
        message: 'Enter the secret key to use? ~>',
      }];
      const answers = program.gui
        ? { secret: Dialog.entry('Enter the secret key to use:', '🝰 dusk') }
        : await inquirer.default.prompt(questions);

      program.withSecret = answers.secret;
    }

    if (typeof program.withSecret === 'string') {
      if (!dusk.utils.isHexaString(program.withSecret)) {
        return reject(new Error('Secret key must be hexidecimal'));
      }

      let sk = Buffer.from(program.withSecret, 'hex');

      if (!secp256k1.privateKeyVerify(sk)) {
        return reject(new Error('Invalid secret key'));
      }

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
    const answers = program.gui
      ? { password: Dialog.password('Enter password', '🝰 dusk') }
      : await inquirer.default.prompt(questions);

    if (answers.password === null) {
      process.exit(1);
    }

    const salt = fs.readFileSync(config.PrivateKeySaltPath);
    const sk = dusk.utils.passwordUnlock(answers.password, salt, encryptedPrivKey);
  
    program.webdavPass = program.webdavPass || answers.password;
    
    resolve(sk);
  }));

  identity = new dusk.eclipse.EclipseIdentity(
    Buffer.from(secp256k1.publicKeyCreate(privkey)),
    nonce,
    proof
  );

  // are we starting the daemon?
  program.D = program.D || program.background;

  if (program.D) {
    console.log('');
    console.log('  [ starting dusk in the background ♥  ]');

    const args =  [
      '--with-secret', privkey.toString('hex'),
      '--webdav-pass', program.webdavPass
    ];

    if (program.gui) {
      args.push('--gui');
    }

    require('daemon').daemon(__filename, args, { cwd: process.cwd() }); 
    exitGracefully();
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
          basePath = path.join(program.datadir, 'shoes');
        } else {
          basePath = config.MetadataDirectory;
        }
        
        if (program.gui) {
          program.retrace = Dialog.file('directory', false, basePath + '/');
        } else {
          program.retrace = await fileSelector({
            type:'directory',
            basePath,
            message: 'Select .duskbundle:',
            filter: (stat) => {
              return path.extname(stat.name) === '.duskbundle';
            }
          });
        }
      }
    }
      
    console.log(`  Validating .duskbundle ...`);

    if (path.extname(program.retrace) !== '.duskbundle') {

      if (program.gui) {
        Dialog.info('Not a valid .duskbundle. Try again?', 'Sorry', 'error');
      }

      console.error('  The path specified does not have a .duskbundle extension.');
      console.error('  Did you choose the right folder?');
      console.error('  If you renamed the folder, make sure it ends in .duskbundle');
      process.exit(1);
    }
    
    const bundleContents = fs.readdirSync(program.retrace); 
    const metaFiles = bundleContents.filter(f => path.extname(f) === '.meta');

    if (metaFiles.length > 1) {

      if (program.gui) {
        Dialog.info('Not a valid .duskbundle. Try again?', 'Sorry', 'error');
      }

      console.error('i found more than one meta file and don\'t know what to do');
      process.exit(1);
    } else if (metaFiles.length === 0) {

      if (program.gui) {
        Dialog.info('Not a valid .duskbundle. Try again?', 'Sorry', 'error');
      }
     
      console.error('missing a meta file, i don\'t know how to retrace this bundle');
      process.exit(1);
    }
    const metaPath = path.join(program.retrace, metaFiles.pop());
    const metaData = JSON.parse(dusk.utils.decrypt(
      privkey.toString('hex'),
      fs.readFileSync(metaPath)
    ).toString('utf8'));
    
    let missingPieces = 0;
    let progressBar;

    console.log('  read meta file successfully ♥ ');
    console.log('');
    console.log('  retracing from merkle leaves... ');

    let shards;
    let rpc;
    
    if (program.usb) {
      shards = (await shoes.retrace(metaData, program, config, exitGracefully)).map(part => {
        if (!part) {
          console.warn('missing part detected');
          missingPieces++;
        
          if (missingPieces > metaData.p) {
            if (program.gui) {
              Dialog.info('Too many missing pieces to recover this file', 
                'Sorry', 'error');
            }
            console.error('too many missing shards to recover this file');
            process.exit(1);
          }  
        
          return Buffer.alloc(dusk.DAGEntry.INPUT_SIZE);
        }
        return part;
      });
    } else if (program.dht || program.local) {
      if (program.gui) {
        progressBar = Dialog.progress('Retracing file ♥ ...', '🝰 dusk', {
          pulsate: true,
          noCancel: true
        });
      }
        
      shards = [];

      console.log('');
      console.log('  ok, I\'m going to try to connect to dusk\'s control socket...');
      rpc = await getRpcControl();
      console.log('');
      console.log('  [ we\'re connected ♥ ]')
      console.log('');
    }

    if (program.local) {
      function getLocal(hexKey) {
        return new Promise((resolve, reject) => {
          rpc.invoke('getlocal', [hexKey], (err, value) => {
            if (err) {
              return reject(err);
            }
            resolve(Buffer.from(value, 'hex'));
          });
        });
      }

      for (let i = 0; i < metaData.l.length; i++) {
        let success;
        
        console.log('  getlocal [  %s  ]', metaData.l[i].toString('hex'));
        
        while (!success) {
          try {
            let shard = await getLocal(metaData.l[i].toString('hex'));
            console.log('  [  done!  ]');
            shards.push(shard);
            success = true;
          } catch (e) {
            console.error(e.message);
            console.log('');

            missingPieces++;
              
            if (missingPieces > metaData.p && !program.dht) {
              if (program.gui) {
                Dialog.info('Too many missing pieces to recover this file right now.', 
                  'Sorry', 'error');
              }

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

    if (program.dht && !missingPieces || (program.dht && (missingPieces && missingPieces > metaData.p))) {
      console.log(`  I will attempt to find ${missingPieces || metaData.l.length} shards in the DHT.`);
      console.log('  This can take a while depending on network conditions and the');
      console.log('  overall size of the file.');
      console.log('');
      console.log('  Make sure you are safe to sit here for a moment and babysit me.');
      console.log('  We will do ' + dusk.constants.SHARD_SIZE + 'bytes at a time, until we are done.');
      console.log(''); 
      
      let ready = { yes: program.yes };

      if (program.gui) {
        ready.yes = ready.yes || Dialog.info(
          `I connected to dusk's control port ♥ 

I will attempt to find ${metaData.l.length} shards in the DHT. This can take a while depending on network conditions and the overall size of the file.

Make sure you are safe to sit here for a moment and babysit me. We will do ${dusk.constants.SHARD_SIZE} at a time, until we are done.

Ready?
          `,
          '🝰 dusk',
          'question'
        ).status === 0;

        if (!ready.yes) {
          Dialog.info('Ok, cancelled.', '🝰 dusk', 'info');
          exitGracefully();
        }
      }

      while (!ready.yes && !program.yes) {
        let answers = await inquirer.default.prompt({
          type: 'confirm',
          name: 'yes',
          message: 'Ready?'
        });
        ready.yes = answers.yes;
      }

      console.log('');
      
      function findvalue(hexKey) {
        return new Promise((resolve, reject) => {
          rpc.invoke('findvalue', [hexKey], (err, data) => {
            if (err) {
              return reject(err);
            }
            if (!data.length || (data.length && data.length > 1)) {
              return reject(new Error('Could not find shard.'));
            }
            resolve(Buffer.from(data.value, 'hex'));
          });
        });
      }

      for (let i = 0; i < metaData.l.length; i++) {
        let success;
        if (progressBar) {
          progressBar.progress((i / metaData.l.length) * 100);
          progressBar.text(`Finding shard ${metaData.l[i].toString('hex')}...`);
        }

        const emptyBuf = Buffer.alloc(dusk.DAGEntry.INPUT_SIZE);
        const currentShard = shards[i];

        if (currentShard && Buffer.compare(emptyBuf, currentShard) !== 0) {
          continue;
        }

        console.log('  findvalue [  %s  ]', metaData.l[i].toString('hex'));
        while (!success) {
          try {
            let shard = await findvalue(metaData.l[i].toString('hex'));
            console.log('  [  done!  ]');
            shards[i] = shard;
            success = true;
          } catch (e) {
            console.error(e.message);
            console.log('');
            let tryAgain = { yes: false };

            if (program.gui && !program.Q) {
              tryAgain.yes = /*program.yes ||*/ Dialog.info(
                `I wasn't able to find the shard. Would you like to try again? If not, I will skip it.`, 
                  '🝰 dusk', 'question').status === 0;
            } else if (!program.Q) {
              tryAgain = /*program.yes ? { yes: true } :*/ await inquirer.default.prompt({
                type: 'confirm',
                name: 'yes',
                message: 'Would you like to try again? If not I will skip it.'
              });
            }

            console.log(tryAgain)

            if (!tryAgain.yes) {
              missingPieces++;
              
              if (missingPieces > metaData.p) {
                if (program.gui) {
                  Dialog.info('Too many missing pieces to recover this file right now.', 
                    'Sorry', 'error');
                }

                console.error('too many missing shards to recover this file');
                process.exit(1);
              }

              shards[i] = (Buffer.alloc(dusk.DAGEntry.INPUT_SIZE));
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
            if (program.gui) {
              Dialog.info('Too many missing pieces to recover this file right now.', 
                'Sorry', 'error');
            }
            console.error('too many missing shards to recover this file');
            process.exit(1);
          }

          return Buffer.alloc(dusk.DAGEntry.INPUT_SIZE);
        }
        return fs.readFileSync(path.join(program.retrace, `${hash}.part`));
      });
    }

    if (progressBar) {
      progressBar.text(' I reconstructed the encrypted file ♥ ');
    }

    console.log('');
    console.log('  [ I reconstructed the encrypted and erasure coded buffer ♥ ]');
    console.log('');
    
    if (missingPieces) {
      if (progressBar) {
        progressBar.text('There were some missing pieces. I will try to recover them...');
      }
      console.log('  attempting to encode missing parts from erasure codes...')
      shards = splitSync(await dusk.reedsol.encodeCorrupted(splitSync(Buffer.concat(shards), {
        bytes: dusk.DAGEntry.INPUT_SIZE
      })), { bytes: dusk.DAGEntry.INPUT_SIZE });
    } 

    while (metaData.p--) {
      shards.pop();
    }

    if (progressBar) {
      progressBar.progress(100);
    }

    if (program.usb) {
      if (program.gui) {
        Dialog.info('USER 0, I am ready to finish retracing and save to your USB drive.', '🝰 dusk / SHOES', 'info');
      }

      console.log('  USER 0, I\'m ready to finish retracing and save to');
      console.log('  your dusk/SHOES USB.');
      console.log('');
      program.datadir = await shoes.mount(program, config, exitGracefully);
    }

    if (program.vfs) {
      program.fileOut = typeof program.vfs === 'string'
        ? program.vfs
        : config.VirtualFileSystemPath;
    }

    const mergedNormalized = Buffer.concat(shards).subarray(0, metaData.s.a);
    const [unbundledFilename] = program.retrace.split('.duskbundle');
    const filename = program.fileOut || 
      path.join(`unbundled-${Date.now()}-${path.basename(unbundledFilename)}`);
    const decryptedFile = dusk.utils.decrypt(privkey.toString('hex'), mergedNormalized);
    const fileBuf = Buffer.from(decryptedFile);
    const trimmedFile = fileBuf.subarray(0, metaData.s.o);

    if (fs.existsSync(filename)) {
      let overwrite;
      let message = 'Are you sure you want to overwrite the current virtual filesystem? ' +
        'If you have not created a recent snapshot, you may lose data!';

      if (program.gui && program.vfs) {
        overwrite = {
          vfs: program.yes ||
            Dialog.info(message, 'Confirm', 'question').status !== 1
        };
      } else if (!program.gui && program.vfs) {
        overwrite = program.yes ? { vfs: true } : await inquirer.default.prompt({
          name: 'vfs',
          type: 'confirm',
          message
        });
      }
      
      if ((program.vfs && !overwrite.vfs) || !program.vfs) {
        if (program.gui) {
          Dialog.info(`${filename} already exists. I won't overwrite it.`, 'Sorry', 'error');
        } else {
          console.error(`${filename} already exists, I won't overwrite it.`);
        }
        
        exitGracefully();
      }
    }

    fs.writeFileSync(filename, trimmedFile);

    if (program.gui) {
      Dialog.notify(`Retraced successfully!\nSaved to ${filename}`, '🝰 dusk');
    }

    console.log('');
    console.log(`  [ File retraced successfully ♥ ]`);
    console.log(`  [ I saved it to ${filename} ♥ ]`);
    console.log('');

    if (program.open) {
      _open([filename], { detached: true });
    }

    exitGracefully();
  }
 
  if (program.exportSecret) {
    if (program.gui) {
      Dialog.entry('Private Key:', '🝰 dusk', privkey.toString('hex'));
    } else if (program.Q) {
      console.log(privkey.toString('hex'));
    } else {
      console.log('secret key ♥ ~ [  %s  ] ', privkey.toString('hex'));
    }
    exitGracefully();
  }

  if (program.exportRecovery) {
    let words = bip39.entropyToMnemonic(privkey.toString('hex'));
    let wordlist = words.split(' ').map((word, i) => `${i+1}.  ${word}`);
    words = wordlist.join('\n');

    if (program.gui) {
      Dialog.textInfo(words, 'Recovery Words');
    } else if (program.Q) {
      console.log(bip39.entropyToMnemonic(privkey.toString('hex')));
    } else {
      console.log('recovery words ♥ ~ [  %s  ] ', bip39.entropyToMnemonic(privkey.toString('hex')));
    }
    process.exit(0);
  }
  let pubkey = Buffer.from(secp256k1.publicKeyCreate(privkey)).toString('hex');

  if (program.encrypt) {
    if (program.ephemeral && program.pubkey) {
      if (program.gui) {
        Dialog.info('I cannot encrypt, because i got contradicting input.', 'Sorry', 'error');
      }
      console.error('i don\'t know how to encrypt this because --ephemeral and --pubkey contradict');
      console.error('choose one or the other');
      process.exit(1);
    }

    if (program.ephemeral) {
      const sk = dusk.utils.generatePrivateKey();
      let words = bip39.entropyToMnemonic(sk.toString('hex'));
      let wordlist = words.split(' ').map((word, i) => `${i+1}.  ${word}`);
      words = wordlist.join('\n');
      program.pubkey = Buffer.from(secp256k1.publicKeyCreate(sk));

      const text = `
  I generated a new key, but I didn't store it.
  I'll encrypt using it, but you'll need to write these words down:

  [  ${words}  ]

  If you lose these words, you won't be able to recover this file from
  a reconstructed bundle - it will be gone forever.`;

      let savedWords = { iPromise: program.yes };
      
      if (program.gui && !savedWords.iPromise) {
        savedWords = {
          iPromise: await Dialog.textInfo(words, 'Recovery Words', {
            checkbox: 'I have written down my recovery words.' 
          }) === 0
        };
      } else {
        console.log(text);
        savedWords = program.yes ? { isPromise: true } : await inquirer.default.prompt({
          name: 'iPromise',
          type: 'confirm',
          message: 'I have written down my recovery words.'
        });
      }

      if (!savedWords.iPromise) {
        const msg = 'I did will not proceed. Try again.';
        if (program.gui) {
          Dialog.info(msg, 'Error', 'error');
          process.exit(1);
        } else {
          console.error(msg);
          process.exit(1);
        }  
      }

      if (program.gui) {
        Dialog.entry('One-time secret:', '🝰 dusk', sk.toString('hex'));
      } else {
        console.log(`  ephemeral secret [ ${sk.toString('hex')} ]`);
      }
    }

    if (!Buffer.isBuffer(program.pubkey)) {
      if (typeof program.pubkey === 'string') {
        pubkey = program.pubkey;
      } else if (program.pubkey === true) {
        // TODO show list dialog of link/seeds pubkeys
        const questions = [{
          type: 'text',
          name: 'pubkey',
          message: 'Enter public key to use for encryption? ~>',
        }];
        const answers = program.gui
          ? { pubkey: Dialog.entry('Enter public key to use for encryption', '🝰 dusk') }
          : await inquirer.default.prompt(questions);

        if (!answers.pubkey) {
          process.exit(1);
        }
        program.pubkey = answers.pubkey;
      } else {
        pubkey = Buffer.from(secp256k1.publicKeyCreate(privkey)).toString('hex');
      }
    } else {
      pubkey = program.pubkey;
    }

    if (typeof program.fileIn === 'string') {
      program.encrypt = fs.readFileSync(program.fileIn);
    } else if (program.fileIn) {
      if (program.gui) {
        program.encrypt = fs.readFileSync(Dialog.file('file', false, false));
      } else {
        program.encrypt = fs.readFileSync(await fileSelector({ 
          message: 'Select file to encrypt' 
        })); 
      }
    } else if (program.encrypt === true) {
      const questions = [{
        type: 'text',
        name: 'encrypt',
        message: 'Enter a message to encrypt? ~>',
      }];
      const answers = program.gui
        ? { encrypt: Dialog.entry('Enter a message to encrypt:', '🝰 dusk') }
        : await inquirer.default.prompt(questions);

      if (!answers.encrypt) {
        process.exit(1);
      }
      program.encrypt = Buffer.from(answers.encrypt, 'utf8');
    } else if (!dusk.utils.isHexaString(program.encrypt)) {
      const msg = 'String arguments to --encrypt [message] must be hexidecimal';
      if (program.gui) {
        Dialog.info(msg, 'Error', 'error');
      } else {
        console.error(msg);
      }
      process.exit(1);
    }

    let ciphertext = dusk.utils.encrypt(pubkey, program.encrypt);
    
    if (program.fileOut) {
      if (fs.existsSync(program.fileOut)) {
        const msg = 'File already exists, I will not overwrite it.';
        if (program.gui) {
          Dialog.info(msg, 'Error', 'error');
        } else {
          console.error(msg);
        }
        process.exit(1);
      }

      fs.writeFileSync(program.fileOut, ciphertext);
      console.log('encrypted ♥ ~ [  file: %s  ] ', program.fileOut);
    } else if (program.gui) {
      Dialog.entry('Encrypted Message:', '🝰 dusk', ciphertext.toString('hex'));
    } else if (!program.Q) {
      console.log('encrypted ♥ ~ [  %s  ] ', ciphertext.toString('hex'));
    } else {
      console.log(ciphertext);
    }

    process.exit(0);
  }

  if (program.pubkey) {
    if (program.gui) {
      Dialog.entry('Public Key:', '🝰 dusk', pubkey);
    } else if (!program.Q) {
      console.log('public key ♥ ~ [  %s  ] ', pubkey);
    } else {
      console.log(pubkey);
    }
    process.exit(0);
  }

  if (program.decrypt) {
    let cleartext;
    if (program.decrypt === true && !program.fileIn) {
      const questions = [{
        type: 'text',
        name: 'decrypt',
        message: 'Enter a message to decrypt? ~>',
      }];
      const answers = program.gui
        ? { decrypt: Dialog.entry('Enter a message to decrypt:', '🝰 dusk') }
        : await inquirer.default.prompt(questions);

      if (!answers.decrypt) {
        process.exit(1);
      }

      program.decrypt = answers.decrypt;
    }

    if (typeof program.decrypt === 'string') {
      if (program.fileIn) {
        console.error('i don\'t know what to decrypt because you passed a string to ');
        console.error('--decrypt but also specified --file-in');
        process.exit(1);
      }
      cleartext = dusk.utils.decrypt(privkey.toString('hex'), Buffer.from(program.decrypt, 'hex'));
    } else {
      const filepath = typeof program.fileIn === 'string' 
        ? program.fileIn 
        : program.gui 
          ? Dialog.file('file', false, false)
          : await fileSelector({ message: 'Select file to decrypt' }); 

      try {
        cleartext = dusk.utils.decrypt(privkey.toString('hex'), 
          fs.readFileSync(filepath));
      } catch (err) {
        console.error(err.message);
        process.exit(1);
      }
    }

    if (program.gui) {
      Dialog.textInfo(cleartext, '🝰 dusk');
    } else if (!program.Q) {
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

    let progress;
    if (program.gui) {
      progress = Dialog.progress(
        'Generating a strong identity key. This can take a while, but only runs once.', 
        '🝰 dusk', 
        { pulsate: true, noCancel: true }
      );
    } 
    await identity.solve();
    if (progress) {
      progress.progress(100);
    }
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
  console.log('');

  if (program.usb) {
    await shoes.init(program, config, privkey, identity);
  }
    
  if (program.setup) {
    if (program.gui) {
      Dialog.info('Setup complete! The device is ready to use. ♥ ', '🝰 dusk', 'info');
    }
    console.log('  Setup complete! The device is ready to use. ♥ ');
    return exitGracefully();
  }

  if (program.usb) {
    const warn = 'Running dusk online with configuration from a USB drive is not readily supported and may not function at all with the defaults.' +
      '\n\nI hope you know what you\'re doing!';

    if (program.gui) {
      Dialog.info(warn, '🝰 dusk', 'warning');
    }

    console.warn(warn);
  }

  initDusk();
}

function _mountAndOpenWebDavMacOS_graphical() {
  const appleScript = `tell application "Finder"
    try
        mount volume "http://${config.WebDAVRootUsername}@127.0.0.1:${config.WebDAVListenPort}"
    end try
end tell`;
  const osaOptions = {
    type: 'AppleScript'
  };

  osascript.eval(appleScript, osaOptions, (err, data) => {
    if (err) {
      Dialog.info(err.message, duskTitle, 'error');
      exitGracefully();
    }
    spawn('open', ['-a', 'Finder', '/Volumes/127.0.0.1']);
  });
}

function showUserCrashReport(err) {
  if (program.gui) {
    Dialog.info(err, '🝰 dusk: fatal', 'error');
  }
  console.log(err);
}

function exitGracefully() {
  try {
    //npid.remove(config.DaemonPidFilePath);
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
  let progress;

  if (program.gui) {
    progress = Dialog.progress('Connecting, hang tight! ♥', '🝰 dusk', {
      pulsate: true,
      noCancel: true
    });
  }
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

  // Setup the WebDAV Bridge
  if (!!parseInt(config.WebDAVEnabled)) {
    function setupWebDAV() {
      const { Readable, Transform } = require('node:stream');

      return new Promise(async (resolve, reject) => {
        if (!program.webdavPass) {
          logger.warn('no password given for dusk - refusing to start webdav bridge');
          return reject(new Error('WebDAV bridge requires a password to be set.'));
        }

        let dropbox;

        // User manager (tells who are the users)
        const userManager = new webdav.SimpleUserManager();
        const rootUser = userManager.addUser(config.WebDAVRootUsername,
          program.webdavPass, true, false);
        const anonUser = userManager.addUser('anon',
          null, false, true);

        // Privilege manager (tells which users can access which files/folders)
        const privilegeManager = new webdav.SimplePathPrivilegeManager();

        // Set root directories
        privilegeManager.setRights(rootUser, '/', [ 'all' ]);
        
        if (!!parseInt(config.WebDAVPublicShareEnabled)) {
          privilegeManager.setRights(anonUser, '/Public', [ 'canRead' ]);
        } 

        const server = new webdav.WebDAVServer({
          requireAuthentication: false, // Default user is anon
          httpAuthentication: new webdav.HTTPDigestAuthentication(userManager, 
            'dusk:' + identity.fingerprint.toString('hex')),
          privilegeManager: privilegeManager,
          isVerbose: true,
          lockTimeout: 3600,
          strictMode: false,
          hostname: '127.0.0.1',
          https: null,
          version: dusk.version.software,
          autoSave: {
            treeFilePath: typeof program.vfs === 'string'
              ? program.vfs
              : config.VirtualFileSystemPath,
            tempTreeFilePath: undefined,
            onSaveError: (err) => {
              logger.error('error saving vfs state, %s', err.message);
            },
            streamProvider: (callback) => {
              const pubkey = secp256k1.publicKeyCreate(privkey);
              let tree = Buffer.from([]);
            
              const toCrypted = new Transform({
                transform(chunk, encoding, callback) {
                  tree = Buffer.concat([tree, chunk]);
                  callback(null);
                },
                flush(callback) {
                  callback(null, dusk.utils.encrypt(pubkey, tree));
                }
              });
              const toGzipped = zlib.createGzip();

              toCrypted.pipe(toGzipped);
              callback(toCrypted, toGzipped);

              // TODO config options for how often to shred the vfs
              // _dusk(['--shred', '--vfs', '--yes', '--dht', '--lazy', '--quiet']);
            }
          },
          autoLoad: {
            treeFilePath: typeof program.vfs === 'string'
              ? program.vfs
              : config.VirtualFileSystemPath,
            streamProvider: (inputStream, callback) => {
              let crypted = Buffer.from([]);
              
              const toDecrypted = new Transform({
                transform(chunk, encoding, callback) {
                  crypted = Buffer.concat([crypted, chunk]);
                  callback(null);
                },
                flush(callback) {
                  callback(null, dusk.utils.decrypt(privkey.toString('hex'), 
                    crypted));
                }
              });

              const toGunzipped = zlib.createGunzip();

              callback(inputStream.pipe(toGunzipped).pipe(toDecrypted));
            }
          },
          storageManager: new webdav.PerUserStorageManager(
            dusk.constants.SHARD_SIZE * dusk.reedsol.MAX_K
          ), 
          // TODO how to make larger? currently limited to 192MiB
          // limit is currently due to :
          // - uniform shard size
          // - reedsolomon params
          // - json serialization @ leveldb
          enableLocationTag: false,
          maxRequestDepth: 1,
          headers: undefined,
          port: parseInt(config.WebDAVListenPort),
          serverName: 'dusk:' + identity.fingerprint.toString('hex')
        });

        if (!!parseInt(config.WebDAVAnonDropboxEnabled)) {
          dropbox = new dusk.Dropbox(node, privilegeManager, server);

          dropbox.on('new_drop', ({codename, numFiles}) => {
            logger.info(`[dropbox] new drop! ${numFiles} files in Dropbox/${codename}`);
            if (program.gui) {
              Dialog.notify(`New file drop received. 
${numFiles} files in Dropbox/${codename}`, duskTitle, 'info');
            }
          });
        }
 
        server.autoLoad((e) => {
          if (e) {
            logger.warn('failed to mount dusk virtual filesystem');
            
            let template = {};

            if (e.code !== 'ENOENT') {
              logger.error(e.message);
              template['Error.log'] = e.message;
            } else {
              template = {
                Documents: webdav.ResourceType.Directory,
                Downloads: webdav.ResourceType.Directory,
                Pictures: webdav.ResourceType.Directory,
                Recordings: webdav.ResourceType.Directory,
                Videos: webdav.ResourceType.Directory
              };
             
              if (!!parseInt(config.WebDAVAnonDropboxEnabled)) {
                template.Dropbox = webdav.ResourceType.Directory;
              }
              
              if (!!parseInt(config.WebDAVPublicShareEnabled)) {
                template.Public = webdav.ResourceType.Directory;
              }

              logger.info('creating one from a template...');

              template['Help.txt'] = fs.readFileSync(
                path.join(__dirname, '../howto.md')
              ).toString();
            }

            server.rootFileSystem().addSubTree(server.createExternalContext(), template);
          }

          const onWebDavReady = (s) => {
            const { port } = s.address();
            const dropPort = port + 1;

            if (dropbox) {
              dropbox.listen(dropPort);
            }
             
            server.tor = hsv3([
              {
                dataDirectory: path.join(config.WebDAVHiddenServiceDirectory, 'dav_onion'),
                virtualPort: 80,
                localMapping: '127.0.0.1:' + port
              }, {
                dataDirectory: path.join(config.WebDAVHiddenServiceDirectory, 'drp_onion'),
                virtualPort: 80,
                localMapping: '127.0.0.1:' + dropPort
              }
            ], {
              DataDirectory: config.WebDAVHiddenServiceDirectory
            });

            server.tor.on('error', e => {
              logger.error('[webdav/tor]  %s', e.message);
              reject(e)
            })
            server.tor.on('ready', () => {
              const webDavOnion = fs.readFileSync(path.join(
                config.WebDAVHiddenServiceDirectory, 'dav_onion', 'hostname'
              )).toString().trim();
              const anonDrpOnion = fs.readFileSync(path.join(
                config.WebDAVHiddenServiceDirectory, 'drp_onion', 'hostname'
              )).toString().trim();
              node.webDavHsAddr = webDavOnion;
              node.webDavLocalAddr = '127.0.0.1:' + port;
              node.anonDrpHsAddr = anonDrpOnion;
              node.anonDrpLocalAddr = '127.0.0.1:' + dropPort;
              console.log('');
              console.log('  webdav url  [  %s  ]', webDavOnion);
              console.log('  drpbox url  [  %s  ]', anonDrpOnion);
              console.log('');
              resolve(server);
            });
          };

          server.start(onWebDavReady);
        });
      });
    }

    try {
      registerControlInterface(); 
    } catch (err) {
      logger.error(err.message);
      exitGracefully();
    }

    try {
      await setupWebDAV();
      if (program.gui && program.open) {
        if (platform() === 'linux') {
          spawn('nautilus', [`dav://${config.WebDAVRootUsername}@127.0.0.1:${config.WebDAVListenPort}`]);
        } else if (platform() === 'darwin') {
          _mountAndOpenWebDavMacOS_graphical();
        } else {
          throw new Error('Unsupported platform');
        }
      }
    } catch (err) {
      logger.error(err.message);
    }
  }

  // Cast network nodes to an array
  if (typeof config.NetworkBootstrapNodes === 'string') {
    config.NetworkBootstrapNodes = config.NetworkBootstrapNodes.trim().split();
  }

  async function joinNetwork(callback) {
    let peers = config.NetworkBootstrapNodes;
    const seedsdir = path.join(program.datadir, 'seeds');

    if (!fs.existsSync(seedsdir)) {
      mkdirp.sync(seedsdir);
    }
    peers = peers.concat(fs.readdirSync(seedsdir).map(fs.readFileSync).map(buf => {
      return buf.toString();
    })).filter(p => !!p);

    if (peers.length === 0) {
      if (program.gui) {
        progress.progress(100);
        Dialog.notify(`You are online, but have not added any peer links. 
Swap links with friends or team members and add them using the menu.

I will still listen for incoming connections. ♥`, '🝰 dusk', 'info');
      }

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
    
    if (program.gui) {
      progress.progress(100);
      progress = Dialog.progress(`Joining network via ${peers.length} links...`, '🝰 dusk', {
        pulsate: true,
        noCancel: true
      });
    }

    async.detectSeries(peers, (url, done) => {
      const contact = dusk.utils.parseContactURL(url);
      logger.info('contacting', contact);
      node.join(contact, (err) => {
        done(null, (err ? false : true) && node.router.size > 1);
      });
    }, (err, result) => {
      if (program.gui) {
        progress.progress(100);
      }
      if (!result) {
        logger.error(err);
        logger.error('failed to join network, will retry in 1 minute');
        if (program.gui) {
          Dialog.info('Failed to join network. I will try again every minute until I get through.', '🝰 dusk', 'warn');
        }
        callback(new Error('Failed to join network'));
      } else { 
        callback(null, result);
      }
    });
  }


  node.listen(parseInt(config.NodeListenPort), async () => {    
    function checkRunning(pid) {
      try {
        return process.kill(pid, 0);
      } catch (error) {
        return error.code === 'EPERM';
      }
    }

    if (fs.existsSync(config.DaemonPidFilePath)) {
      const pid = parseInt(fs.readFileSync(config.DaemonPidFilePath).toString().trim());
    
      if (checkRunning(pid)) {
        console.error(`It appears that dusk already running with pid ${pid}? Try dusk --kill`);
        exitGracefully();
      } else {
        fs.unlinkSync(config.DaemonPidFilePath);
      }
    }

    try {
      logger.info(`writing pid file to ${config.DaemonPidFilePath}`);
      npid.create(config.DaemonPidFilePath)//.removeOnExit();
    } catch (err) {
      console.error(err);
      console.error('Failed to create PID file, is dusk already running?');
      process.exit(1);
    }

    logger.info('dusk is running! your identity is:');
    const identBundle = dusk.utils.getContactURL([node.identity, node.contact]); 
    logger.info(identBundle);
    fs.writeFileSync(
      config.DrefLinkPath,
      identBundle
    ); 

    async.retry({
      times: Infinity,
      interval: 60000
    }, done => joinNetwork(done), (err, entry) => {
      if (err) {
        logger.error(err.message);
        process.exit(1);
      }
      
      if (program.gui) {
        Dialog.notify(`Connected (${node.router.size} peers) ♥`, '🝰 dusk', 
          path.join(__dirname, '../assets/images/favicon.png'));
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
      if (program.gui) {
        // Dialog.info(`Failed to connect to the dusk daemon. Is it running? \n\n ${e.message}`, '🝰 dusk', 'error');
      }

      reject(e);
      console.error(e.message);
    }

    const client = new boscar.Client();

    if (parseInt(config.ControlPortEnabled)) {
      client.connect(parseInt(config.ControlPort));
    } else if (parseInt(config.ControlSockEnabled)) {
      client.connect(config.ControlSock);
    }

    client.on('ready', () => resolve(client));

    client.socket.on('close', () => {
    
    });

    client.on('error', err => {
      if (program.gui) {
        //Dialog.info(`Failed to connect to the dusk daemon. Is it running? \n\n ${err.message}`, '🝰 dusk', 'error');
      }
      reject(err);  
    });
  });
}

let rpc;

async function displayMenu() {
  let progressBar;
  let answer; 

  if (program.gui) {
    progressBar = Dialog.progress('Connecting ♥ ...', '🝰 dusk', {
      pulsate: true,
      noCancel: true
    });
  }

  if (!rpc) { 
    try {
      rpc = await getRpcControl();
    } catch (e) {
      const args = ['--background'];
      if (program.gui) {
        args.push('--gui');
      }
      _dusk(args, { 
        stdio: 'inherit', 
        detached: false 
      });
      while (!rpc) {
        try { rpc = await getRpcControl() } catch (err) {}
      }    
    }
  }

  if (progressBar) {
    progressBar.progress(100);
  }

  if (program.open) {
    rpc.invoke('getinfo', [], (err, info) => {
      if (program.gui) {
        if (err) {
          Dialog.info(err, 'Sorry', 'error');
        } else {
          if (platform() === 'linux') {
            spawn('nautilus', ['dav://' + config.WebDAVRootUsername + '@127.0.0.1:' + config.WebDAVListenPort]);
          } else if (platform() === 'darwin') {
            _mountAndOpenWebDavMacOS_graphical();
          } else {
            throw new Error('Unsupported platform!')
          }
        }
      } else {
        if (err) {
          console.error(err);
        } else {
          let f = spawn('cadaver', ['http://'+ config.WebDAVRootUsername + '@127.0.0.1:' + config.WebDAVListenPort], {
            stdio: 'inherit'
          });
          f.on('close', mainMenu);
        }
      }
    });
  } else {
    mainMenu();
  }

  async function mainMenu() {
    let option;
    let submenu = typeof program.I === 'string'
      ? program.I
      : null;

    const submenus = [
      'files',
      'snapshots',
      'links',
      'shoes',
      'status',
      'disconnect',
      'utils',
      'config',
      'debug',
      'panic',
      'update',
      'restart',
      'donate',
      'exit'
    ];

    if (submenu) {
      option = { option: submenus.indexOf(program.I) };
      program.I = true;
    } else if (program.gui) {
      option = { option: Dialog.list(duskTitle, ' ', [
        ['🗃️  Files'],
        ['💽  Snapshots'],
        ['🔗  Links'], 
        ['👟  Sneakernets'],
        ['📻  Status'],
        ['🔌  Disconnect'],
        ['🔑  [caution!] Utilities'], 
        ['🛠️  [caution!] Settings'],
        ['🐛  [caution!] Debugging'], 
        ['💣  [caution!] Panic'],
        ['🌟  Update'],
        ['♻️   Restart'],
        ['🩷  Donate'],
        ['✌   Exit']
      ], ['Main Menu'],{ height: 540 }) }; 
    } else {
      option = await inquirer.default.prompt({
        type: 'list',
        name: 'option',
        message: 'Main Menu',
        choices: [
          {
            name: '🗃️   Files',
            value: 0
          },{
            name: '💽  Snapshots',
            value: 1
          },{
            name: '🔗  Links',
            value: 2
          },{
            name: '👟  Sneakernets',
            value: 3
          },{
            name: '📻  Status',
            value: 4
          },{
            name: '🔌  Disconnect',
            value: 5
          }, new inquirer.default.Separator(), {
            name: '🔑  [caution!] Utilities',
            value: 6
          },{
            name: '🛠️   [caution!] Settings',
            value: 7
          }, {
            name: '🐛  [caution!] Debugging',
            value: 8
          }, new inquirer.default.Separator(), {
            name: '💣  [caution!] Panic',
            value: 9
          }, new inquirer.default.Separator(), {
            name: '🌟  Update',
            value: 10
          }, {
            name: '♻️   Restart',
            value: 11
          }, {
            name: '🩷  Donate',
            value: 12
          },{
            name: '✌   Exit',
            value: null
          }, new inquirer.default.Separator()
        ]
      });
    }

    switch (option && option.option) {
        case 0:
          openFiles();
          break;
        case 1:
          fileUtilities();
          break;
        case 2:
          manageDeviceLinks();
          break;
        case 3:
          createSneakernet();
          break;
        case 4:
          showAboutInfo()
          break;
        case 5:
          toggleConnection();
          break;
        case 6: 
          encryptionUtilities();
          break;
        case 7:
          editPreferences();
          break;
        case 8:
          viewDebugLogs();
          break;
        case 9:
          selfDestruct();
          break;
        case 10:
          runUpdater();
          break;
        case 11:
          restartApp();
          break;
        case 12:
          openLiberapay();
          break;
        default:
          exitGracefully();
      }
  }
}

function runUpdater() {
  let f;
  if (program.gui) {
    f = _dusk(['--update', '--restart', '--gui']);
  } else {
    f = _dusk(['--update', '--restart']);
  }
  f.on('close', displayMenu);
}

function restartApp() {
  let f;
  if (program.gui) {
    f = _dusk(['--restart', '--gui']);
  } else {
    f = _dusk(['--restart']);
  }
  f.on('close', displayMenu);
}

async function openFiles() {
  const info = await _getInfo(rpc);
  let f;

  if (program.gui) {
    if (platform() === 'linux') {
      f = spawn('nautilus', ['dav://' + config.WebDAVRootUsername + '@' + info.webdav.local]);
    } else if (platform() === 'darwin') {
      _mountAndOpenWebDavMacOS_graphical();
    }
  } else {
    let hasWebDavCli;

    try {
      hasWebDavCli = !!execSync('which cadaver').toString().trim();
    } catch (err) {
      console.log('');
      console.error('The cadaver program was not in your PATH. Is it installed?');
      return displayMenu();
    }

    if (!hasWebDavCli) {
      console.log('');
      console.error('The cadaver program was not in your PATH. Is it installed?');
      return displayMenu();
    }

    f = spawn('cadaver', [`http://${config.WebDAVRootUsername}@${info.webdav.local}`], {
      stdio: 'inherit'
    });
  }
  f && f.on('close', displayMenu);
}

function resetToDefaults() {
  let f;
  if (program.gui) {
    f = _dusk(['--reset', '--gui']);
  } else {
    f = _dusk(['--reset']);
  }
  f.on('close', () => {
    let f2;
    if (program.gui) {
      f2 = _dusk(['--restart', '--background', '--gui']);
    } else {
      f2 = _dusk(['--restart', '--background']);
    } 
    f2.on('close', displayMenu);
  });
}

function selfDestruct() {
  let f;
  if (program.gui) {
    f = _dusk(['--destroy', '--gui', '--quiet']);
  } else {
    f = _dusk(['--destroy', '--quiet']);
  }
  f.on('close', exitGracefully);
}

async function showAboutInfo() {
  rpc.invoke('getinfo', [], (err, info) => {
    if (err) {
      Dialog.info(err, 'Sorry', 'error');
    } else {
      _showInfo(info);
    }
  });

  async function _showInfo(info) {
    const dialogOptions = {
      width: 300,
    };
    const dialogTitle = `${duskTitle}`;
    const version  = `${info.versions.software}:${info.versions.protocol}`

    let option;

    const dialogText = `Version: ${version}
Peers:  ${info.peers.length}
WebDAV: http://${info.webdav.onion || '  [ ... loading ... ]  '}
Dropbox: http://${info.drpbox.onion || '  [ ... loading ... ]  '}

anti-©opyright, 2024 tactical chihuahua 
licensed under the agpl 3
`;

    if (program.gui) {
      option = { option: Dialog.list(duskTitle, dialogText, [
        ['📷  Show WebDAV Address QR'],
        ['📷  Show Dropbox Address QR']
      ], ['📻  Status'],{ height: 200 }) }; 
    } else {
      console.info(`
${dialogText}\n`);
      option = await inquirer.default.prompt({
        type: 'list',
        name: 'option',
        message: '📻  Status',
        choices: [
          {
            name: '📷  Show WebDAV Address QR',
            value: 0
          }, {
            name: '📷  Show Dropbox Address QR',
            value: 1
          }, new inquirer.default.Separator(), {
            name: '↩️   Back',
            value: null
          },
          new inquirer.default.Separator()
        ]
      });
    }

    switch (option && option.option) {
      case 0:
        if (program.gui) {
          let tmpcode = path.join(tmpdir(), dusk.utils.getRandomKeyString() + '.png');
          qrcode.toFile(tmpcode, 'http://'+ config.WebDAVRootUsername + '@' + info.webdav.onion, 
            { scale: 20 }).then(() => {
              _open([tmpcode]).on('close', showAboutInfo);
          }, exitGracefully);
        } else {
          qrcode.toString('http://' + config.WebDAVRootUsername + '@' + info.webdav.onion, 
            { terminal: true }, (err, code) => {
              if (err) {
                console.error(err);
                exitGracefully();
              }

              console.log('  Scan the QR code below and open the URL in your WebDAV client.');
              console.log('    ~~> Need help? See https://rundusk.org.');
              console.log(code);
              showAboutInfo();
            });
        }
        break;
      case 1:
        if (program.gui) {
          let tmpcode = path.join(tmpdir(), dusk.utils.getRandomKeyString() + '.png');
          qrcode.toFile(tmpcode, 'http://'+ info.drpbox.onion, 
            { scale: 20 }).then(() => {
              _open([tmpcode]).on('close', showAboutInfo);
          }, exitGracefully);
        } else {
          qrcode.toString('http://' + info.drpbox.onion, 
            { terminal: true }, (err, code) => {
              if (err) {
                console.error(err);
                exitGracefully();
              }

              console.log('  Scan the QR code below and open the URL in Tor Browser.');
              console.log('    ~~> Need help? See https://rundusk.org.');
              console.log(code);
              showAboutInfo();
            });
        }
        break;
      default:
        displayMenu();
    }
  }
}

function _getInfo(rpc) {
  return new Promise((resolve, reject) => {
    rpc.invoke('getinfo', [], (err, info) => {
      if (err) {
        reject(err);
      } else {
        resolve(info);
      }
    });
  });
}

async function fileUtilities(actions) {
  let option;

  if (program.gui) {
    option = { option: Dialog.list(duskTitle, 'What would you like to do?', [
      ['🌠  Create a Snapshot'], 
      ['🔮  Restore a Snapshot'] 
    ], ['💽  Snapshots'],{ height: 600 }) };
  } else {
    option = await inquirer.default.prompt({
      type: 'list',
      name: 'option',
      message: '💽  Snapshots', 
      choices: [
        {
          name: '🌠  Create a Snapshot',
          value: 0
        }, {
          name: '🔮  Restore a Snapshot',
          value: 1
        }, new inquirer.default.Separator(), {
          name: '↩️   Back', 
          value: null
        }, new inquirer.default.Separator()
      ]
    });
  }

  let f;

  switch (option && option.option) {
    case 0:
          case 0:
      if (program.gui) {
        f = _dusk(['--shred', '--vfs', '--dht', '--lazy', '--gui']);
      } else {
        f = _dusk(['--shred', '--vfs', '--dht', '--lazy']);
      }
      break;
    case 1:
      if (program.gui) {
        f = _dusk(['--retrace', '--vfs', '--dht', '--local', '--gui']);
      } else {
        f = _dusk(['--retrace', '--vfs', '--dht', '--local']);
      }
      break;
    default:
      displayMenu();
  }
  
  f && f.on('close', () => {
    let f2;
    if (program.gui) {
      f2 = _dusk(['--restart', '--background', '--gui']);
    } else {
      f2 = _dusk(['--restart', '--background']);
    } 
    f2.on('close', fileUtilities);
  });
}

async function manageDeviceLinks(actions) {
  let option;

  if (program.gui) {
    option = { option: Dialog.list(duskTitle, 'What would you like to do?', [
      ['🔍  Show my device link'], 
      ['🫂  View linked devices'], 
      ['🖇️  Link a new device'], 
      ['📵  Remove a linked device'], 
    ], ['🔗  Device Links / Network Seeds'],{ height: 600 }) };
  } else {
    option = await inquirer.default.prompt({
      type: 'list',
      name: 'option',
      message: '🔗  Devices', 
      choices: [
        {
          name: '🔍  Show my device link',
          value: 0
        }, {
          name: '🫂  View linked devices',
          value: 1
        }, {
          name: '🖇️   Link a new device',
          value: 2
        }, {
          name: '📵  Remove a linked device',
          value: 3
        }, new inquirer.default.Separator(), {
          name: '↩️   Back', 
          value: null
        }, new inquirer.default.Separator()
      ]
    });
  }

  let f;

  switch (option && option.option) {
    case 0:
      f = _dusk(['--export-link', `${program.gui?'--gui':''}`]);
      break;
    case 1:
      f = _dusk(['--show-links', `${program.gui?'--gui':''}`]);
      break;
    case 2:
      if (program.gui) {
        f = _dusk(['--link', '--gui']);
      } else {
        f = _dusk(['--link']);
      }
      break;
    case 3:
      if (program.gui) {
        f = _dusk(['--unlink', '--gui']);
      } else {
        f = _dusk(['--unlink']);
      }
      break;
    default:
      displayMenu();
  }

  f && f.on('close', manageDeviceLinks);
}

async function encryptionUtilities(action) {
  let tool;

  if (program.gui) {
    tool = { option: Dialog.list(duskTitle, 'What would you like to do?', [
      ['🤳  Encrypt a message (for myself)'], 
      ['🎁  Encrypt a message (for someone else)'], 
      ['👻  Encrypt a message (using a one-time secret)'], 
      ['📖  Decrypt a message (using my default secret)'],
      ['🔦  Decrypt a message (using a provided secret)'],
      ['🪪  Export my public key'],
      ['🔐  Export my secret key'],
      ['✍   Export my recovery words'],
      ['🗝️  Restore from a secret key'],
      ['📓  Restore from recovery words']
    ], ['🔑  Encryption Utilities'],{ height: 600 }) };
  } else {
    tool = await inquirer.default.prompt({
      type: 'list',
      message: '🔑  Encryption',
      name: 'option',
      choices: [
        {
          name: '🤳  Encrypt a message (for myself)',
          value: 0
        }, {
          name: '🎁  Encrypt a message (for someone else)',
          value: 1
        }, {
          name: '👻   Encrypt a message (using a one-time secret)',
          value: 2
        }, new inquirer.default.Separator(), {
          name: '📖  Decrypt a message (using my default secret)',
          value: 3
        }, {
          name: '🔦    Decrypt a message (using a provided secret)',
          value: 4
        }, new inquirer.default.Separator(), {
          name: '🪪   Export my public key',
          value: 5
        }, {
          name: '🔐  Export my secret key',
          value: 6
        }, {
          name: '✍   Export my recovery words',
          value: 7
        }, new inquirer.default.Separator(), {
          name: '🗝️  Restore from a secret key',
          value: 8
        }, {
          name: '📓  Restore from recovery words',
          value: 9
        }, new inquirer.default.Separator(), {
          name: '↩️   Back',
          value: null
        }, new inquirer.default.Separator()
      ]
    });
  } 

  let f;

  switch (tool && tool.option) {
    case 0:
      if (program.gui) {
        f = _dusk(['--encrypt', '--gui']);
      } else {
        f = _dusk(['--encrypt']);
      }
      break;
    case 1:
      if (program.gui) {
        f = _dusk(['--encrypt', '--pubkey', '--gui']);
      } else {
        f = _dusk(['--encrypt', '--pubkey']);
      }
      break;
    case 2:
      if (program.gui) {
        f = _dusk(['--encrypt', '--ephemeral', '--gui']);
      } else {
        f = _dusk(['--encrypt', '--ephemeral']);
      }
      break;
    case 3: 
      if (program.gui) {
        f = _dusk(['--decrypt', '--gui']);
      } else {
        f = _dusk(['--decrypt']);
      }      
      break;
    case 4:
      if (program.gui) {
        f = _dusk(['--decrypt', '--with-secret', '--gui']);
      } else {
        f = _dusk(['--decrypt', '--with-secret']);
      }
      break;
    case 5:
      if (program.gui) {
        f = _dusk(['--pubkey', '--gui']);
      } else {
        f = _dusk(['--pubkey']);
      }
      break;
    case 6:
      if (program.gui) {
        f = _dusk(['--export-secret', '--gui']);
      } else {
        f = _dusk(['--export-secret']);
      }
      break;
    case 7:
      if (program.gui) {
        f = _dusk(['--export-recovery', '--gui']);
      } else {
        f = _dusk(['--export-recovery']);
      }
      break;
    case 8:
      _dusk(['--shutdown']).on('close', () => {
        if (program.gui) {
          f = _dusk(['--import-secret', '--gui']);
        } else {
          f = _dusk(['--import-secret']);
        }
      });
      break;
    case 9:
      _dusk(['--shutdown']).on('close', () => {
        if (program.gui) {
          f = _dusk(['--import-recovery', '--gui']);
        } else {
          f = _dusk(['--import-recovery']);
        }
      });
      break;
    default:
      displayMenu();
  }

  f && f.on('close', encryptionUtilities);
}

async function createSneakernet() {
  let tool;

  if (program.gui) {
    tool = { option: Dialog.list(shoesTitle, 'What would you like to do?', [
      ['💾  Create a Sneakernet'], 
      ['🪄  Backup a Snapshot to Sneakernet'],
      ['🧩  Restore a Snapshot from Sneakernet']
    ], ['👟  Sneakernet Tools'],{ height: 400 }) };
  } else {
    tool = await inquirer.default.prompt({
      type: 'list',
      name: 'option',
      message: '👟  Sneakernet',
      choices: [
        {
          name: '💾  Create a Sneakernet',
          value: 0
        }, {
          name: '🪄  Backup a Snapshot to Sneakernet',
          value: 1
        }, {
          name: '🧩  Restore a Snapshot from Sneakernet',
          value: 2
        }, new inquirer.default.Separator(), {
          name: '↩️   Back',
          value: null
        }, new inquirer.default.Separator()
      ]
    });
  }

  let f;

  switch (tool && tool.option) {
    case 0:
      if (program.gui) {
        f = _dusk(['--usb', '--setup', '--gui']);
      } else {
        f = _dusk(['--usb', '--setup']);
      }
      break;
    case 1:
      if (program.gui) {
        f = _dusk(['--usb', '--vfs', '--shred', '--gui']);
      } else {
        f = _dusk(['--usb', '--vfs', '--shred']);
      }
      break;
    case 2:
      if (program.gui) {
        f = _dusk(['--usb', '--vfs', '--retrace', '--gui']);
      } else {
        f = _dusk(['--usb', '--vfs', '--retrace']);
      }
      break;
    default:
      displayMenu();
  }

  f && f.on('close', createSneakernet);
}

async function editPreferences() { 
  if (program.gui) {
    Dialog.info('You can break your installation if you are not careful! Consult the User Guide before making any changes!', 'WARNING', 'warning');
  } else {
    console.warn('You can break your installation if you are not careful! Consult the User Guide before making any changes!');
  }

  if (program.gui) {
    if (platform() === 'linux') {
      execSync(`xdg-open ${program.C}`);
    } else {
      execSync(`open ${program.C}`);
    }
    Dialog.info(`You must restart dusk for the changes to take effect.`, duskTitle, 'info');
  } else {
    if (platform() === 'linux') {
      execSync(`editor ${program.C}`);
    } else {
      execSync(`open -e ${program.C}`);
    }
    console.info('You must restart dusk for the changes to take effect.');
  }
  displayMenu();
}

function viewDebugLogs() {
  let f;

  if (program.gui) {
    f = _dusk(['--logs', '--gui']);
  } else {
    f = _dusk(['--logs']);
  }

  f.on('close', displayMenu);    
}

async function toggleConnection() {
  let confirm, f;

  if (rpc) {
    if (program.gui) {
      confirm = { discon: Dialog.info('You will be disconnected from dusk.', 'Exit?', 'question').status === 0 };
    } else {
      confirm = await inquirer.default.prompt({
        type: 'confirm',
        name: 'discon',
        message: 'You will be disconnected from dusk. Exit?'
      });
    }

    if (confirm.discon) {
      f = _dusk(['--kill', '--quiet']);
      f.on('close', exitGracefully);
    } else {
      displayMenu();
    }
  } else {
    displayMenu();
  }
}

function openLiberapay() {
  const donateUrl = 'https://liberapay.com/rundusk/';
  if (program.gui) {
    _open([donateUrl]);
  } else {
    console.log('');
    console.log(`  Want to help me sustain ${duskTitle}'s ongoing development?
    
    ~~> [  ${donateUrl}  ]

  Thank you, friend! ♥`);
    console.log('');
  }

  displayMenu();
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
} else if (program.I) {
  displayMenu();
} else if (program.X) {
  console.log(description);
  console.log('  [ launching dusk explorer... ]')

  if (program.gui) {
    console.log('  [ using graphical interface ]');
    exitGracefully();
  } else {
    console.error('  [ using console interface ]');
    exitGracefully();
  }
} else if (program.F) { // --logs
  _config();

  const numLines = program.F === true 
    ? 500
    : parseInt(program.F);

  if (program.gui) {
    _open([config.LogFilePath]);
  } else {
    const tail = spawn('tail', ['-n', numLines, config.LogFilePath]);
    const pretty = spawn(
      path.join(__dirname, '../node_modules/bunyan/bin/bunyan'),
      ['--color']
    );
    pretty.stdout.pipe(process.stdout);
    tail.stdout.pipe(pretty.stdin);
  }
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
} else if (program.showLinks) {
  const seedsdir = path.join(program.datadir, 'seeds');
  const values = fs.readdirSync(seedsdir).map(v => {
    const value = v.split('.');
    value.push(fs.readFileSync(path.join(seedsdir, v)).toString());
    return value;
  });

  if (!values.length) {
    values.push(['-', '-', '-']);
  }

  if (program.gui) {
    Dialog.list('🝰 dusk', 'Linked devices:', values, ['Fingerprint', 'Name', 'Link'], {
      width: 800,
      height:500
    });
  } else {
    values.forEach(v => {
      console.log('');
      console.log('Name:', v[1]);
      console.log('Fingerprint:', v[0]);
      console.log('Link:', v[2]);
      console.log('');
    });
  }
} else if (program.link) {
  console.log(description);

  async function _link() {
    if (program.link === true){
      const questions = [{
        type: 'text',
        name: 'link',
        message: 'Enter a device link to add? ~>',
      }];
      const answers = program.gui
        ? { link: Dialog.entry('Enter a device link to add:', '🝰 dusk') }
        : await inquirer.default.prompt(questions);

      if (!answers.link) {
        process.exit(1);
      }

      program.link = answers.link;
    }

    try {
      const [id] = dusk.utils.parseContactURL(program.link);
      const seedsdir = path.join(program.datadir, 'seeds');
      const randomName = uniqueNamesGenerator({ 
        dictionaries: [adjectives, colors, animals] 
      });
      console.log('  saving seed to %s', seedsdir);
      console.log('  i will connect to this node on startup');
      fs.writeFileSync(path.join(seedsdir, `${id}.${randomName}`), program.link);
      
      if (program.gui) {
        Dialog.notify(`I will connect to device "${randomName}" on startup`, 
          'Device linked!');
      }
      console.log('');
      console.log(`  [  done ♥  device codename: ${randomName} ]`)
    } catch (e) {
      if (program.gui) {
        Dialog.info(e.message, 'Sorry', 'error');
      }
      console.error(e.message);
      process.exit(1);
    }
  }
  _link();
} else if (program.unlink) {
  console.log(description);
  
  async function _unlink() {
    const seedsdir = path.join(program.datadir, 'seeds');
    let idOrShortname;

    if (fs.readdirSync(seedsdir).length === 0) {
      if (program.gui) {
        Dialog.info('No devices to unlink.', 'Sorry', 'error');
      } else {
        console.error('No devices to unlink.')
      }
      process.exit(1);
    }

    if (program.unlink === true) {
      let answer;
      const choices = {
        message: 'Select a device to unlink? ~>',
        choices: fs.readdirSync(seedsdir).map(val => {
          const [id, shortname] = val.split('.');
          return {
            name: shortname,
            value: id,
            description: `(${id})`
          }
        })
      };
      if (program.gui) {
        let d = new Dialog('🝰 dusk', {
          text: 'Select the device to unlink...'
        });
        d.combo('unlink', 'Devices', fs.readdirSync(seedsdir).map(v => {
          return v.split('.')[1];
        }));
        answer = d.show();

      } else {
        answer = { unlink: await inquirer.default.prompt.prompts.select(choices) };
      }

      if (!answer || !answer.unlink) {
        process.exit(1);
      }

      idOrShortname = answer.unlink;
    } else {
      idOrShortname = program.unlink;
    }

    try {  
      let match = null;
      let links = fs.readdirSync(seedsdir);

      for (let i = 0; i < links.length; i++) {
        let [id, shortname] = links[i].split('.');
        if (idOrShortname === id || idOrShortname === shortname) {
          match = links[i];
          break;
        }
      }

      if (!match) {
        if (program.gui) {
          Dialog.info('I do not recognize that link', 'Sorry', 'error');
        } else {
          console.error('I do not recognize that link.');
        }
        process.exit(1);
      }

      console.log('  removing %s from %s', program.unlink, seedsdir);
      console.log('');
      console.log('  i will not connect to this node on startup');
      fs.unlinkSync(path.join(seedsdir, match));
      console.log('');
      console.log('  [  done ♥  ]');
      if (program.gui) {
        Dialog.notify('I will not connect the this link on startup anymore', 
          'Device unlinked');
      }
    } catch (e) {
      if (program.gui) {
        Dialog.info(e, 'Fatal', 'error');
      }
      console.error(e.message);
      process.exit(1);
    }
  }

  _unlink();
} else {
  // Otherwise, kick everything off
  _init();
}
