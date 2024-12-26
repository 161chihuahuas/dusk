'use strict';

const Tray = require('systray').default;
const { spawn, fork } = require('node:child_process');
const path = require('node:path');
const Dialog = require('../lib/zenity');
const fs = require('node:fs');
const fuse = require('./fuse.js');
const mkdirp = require('mkdirp');

const shoesTitle = '🝰 dusk / SHOES '
const duskTitle = '🝰 dusk'

function _dusk(args) {
  return fork(path.join(__dirname, 'dusk.js'), args);
}

function _init(rpc, program, config, exitGracefully) {
  const NET_STATUS_CONNECTING = { 
    type: 'update-item', 
    seq_id: 0, 
    item: { 
      checked: false, 
      enabled: false, 
      title: '🔄  Connecting...' 
    }
  };
  const NET_STATUS_CONNECTED = { 
    type: 'update-item', 
    seq_id: 0, 
    item: {
      checked: false, 
      enabled: false, 
      title: ' 🔐  Connected' 
    }
  };
  const NET_STATUS_LISTENING = { 
    type: 'update-item', 
    seq_id: 0, 
    item: {
      checked: false, 
      enabled: false, 
      title: '⌚  Waiting for a link...' 
    }
  };

  const FUSE_STATUS_NOT_MOUNTED = {
    type: 'update-item',
    seq_id: 2,
    item: {
      title: '🗂  Mount virtual folders',
      enabled: true,
      checked: false
    }
  };
  const FUSE_STATUS_MOUNTED = {
    type: 'update-item',
    seq_id: 2,
    item: {
      title: '🗂  Unmount virtual folders',
      enabled: true,
      checked: false
    }
  };
  const FUSE_STATUS_MOUNTING = {
    type: 'update-item',
    seq_id: 2,
    item: {
      title: '🗂  Mounting virtual folders...',
      enabled: false,
      checked: false
    }
  };

  const tray = new Tray({
    menu: {
      icon: fs.readFileSync(path.join(__dirname, '../assets/images/favicon.png')).toString('base64'),
      title: '🝰 dusk',
      tooltip: '🝰 dusk',
      items: [
        NET_STATUS_CONNECTING.item,
        {
          title: 'ℹ️  Show about info',
          enabled: true,
          checked: false
        },
        {
          title: '🔗  Manage device links',
          enabled: true,
          checked: false
        },
        FUSE_STATUS_NOT_MOUNTED.item,
        {
          title: '🔑  Encryption utilities',
          enabled: true,
          check: false
        },
        {
          title: '👟 USB sneakernet tools',
          enabled: true,
          checked: false
        },
        {
          title: '🗜  Edit preferences',
          enabled: true,
          checked: false
        },
        {
          title: '🗒  View debug logs',
          enabled: true,
          checked: false
        },
        {
          title: '🔌  Disconnect and exit',
          checked: false,
          enabled: true
        }
      ]
    },
    debug: false,
    copyDir: false
  });
 
  tray.onClick(action => {
    switch (action.seq_id) {
      case 0: // Status indicator
        break;
      case 1: // Show network info
        showAboutInfo(action);
        break;
      case 2: // Link peer device
        manageDeviceLinks(action);
        break;
      case 3: // Mount virtual folders
        toggleMountVirtualFolders(action);
        break;
      case 4: // Encryption tools dialogs
        encryptionUtilities(action);
        break;
      case 5: // Sneakernet setup, shred and retracing
        createSneakernet(action);
        break;
      case 6: // Edit preferences
        editPreferences(action);
        break;
      case 7: // View debug logs
        viewDebugLogs(action);
        break;
      case 8: // Disconnect and exit
        disconnectAndExit(action); 
        break;
      default:
        // noop
    } 
  });

  function showAboutInfo(action) {
    rpc.invoke('getinfo', [], (err, info) => {
      if (err) {
        Dialog.info(err, 'Sorry', 'error');
      } else {
        _showInfo(info);
      }
    });

    function _showInfo(info) {
      const dialogOptions = {
        width: 300,
      };
      const dialogTitle = `${duskTitle}`;
      const version  = `${info.versions.software}:${info.versions.protocol}`

      const dialogText = `Version: ${version}
Peers: ${info.peers.length}

anti-©opyright, 2024 tactical chihuahua 
licensed under the agpl 3
`;

      Dialog.info(dialogText, dialogTitle, 'info', dialogOptions); 
    }
  }

  function manageDeviceLinks(actions) {
    const option = Dialog.list(duskTitle, 'What would you like to do?', [
      ['Show my device link'], 
      ['View linked devices'], 
      ['Link a new device'], 
      ['Remove a linked device'], 
    ], ['Device Links / Network Seeds'],{ height: 600 });
    
    switch (option) {
      case 0:
        _dusk(['--export-link', '--gui']);
        break;
      case 1:
        _dusk(['--show-links', '--gui']);
        break;
      case 2:
        _dusk(['--link', '--gui']);
        break;
      case 3:
        _dusk(['--unlink', '--gui']);
        break;
      default:
        // noop
    }
  }

  async function toggleMountVirtualFolders(action) {
    try {
      mkdirp.sync('/tmp/dusk.vfs');
      await fuse('/tmp/dusk.vfs');
    } catch (e) {
      return Dialog.info(e, 'Sorry', 'error');
    }
    Dialog.notify('Virtual filesystem mounted.\n/tmp/dusk.vfs');
  }

  function encryptionUtilities(action) {
    const tool = Dialog.list(shoesTitle, 'What would you like to do?', [
      ['Encrypt a message (for myself)'], 
      ['Encrypt a message (for someone else)'], 
      ['Encrypt a message (using a one-time secret)'], 
      ['Decrypt a message (using my default secret)'],
      ['Decrypt a message (using a provided secret)'],
      ['Export my public key'],
      ['Export my secret key'],
      ['Show my recovery words']
    ], ['Encryption Utilities'],{ height: 600 });
    
    switch (tool) {
      case 0:
        _dusk(['--encrypt', '--gui']);
        break;
      case 1:
        _dusk(['--encrypt', '--pubkey', '--gui']);
        break;
      case 2:
        _dusk(['--encrypt', '--ephemeral', '--gui']);
        break;
      case 3:
        _dusk(['--decrypt', '--gui']);
        break;
      case 4:
        _dusk(['--decrypt', '--with-secret', '--gui']);
        break;
      case 5:
        _dusk(['--pubkey', '--gui']);
        break;
      case 6:
        _dusk(['--export-secret', '--gui']);
        break;
      case 7:
        _dusk(['--export-recovery', '--gui']);
        break;
      case 8:
        
        break;
      default:
        // noop
    }
  }

  function createSneakernet(action) {
    const tool = Dialog.list(shoesTitle, 'What would you like to do?', [
      ['Setup a new USB drive'], 
      ['Shred a file to sneakernet'],
      ['Retrace a file from sneakernet']
    ], ['Sneakernet Tools'],{ height: 400 });
    
    switch (tool) {
      case 0:
        _dusk(['--usb', '--setup', '--gui']);
        break;
      case 1:
        _dusk(['--usb', '--shred', '--gui']);
        break;
      case 2:
        _dusk(['--usb', '--retrace', '--gui']);
      default:
        // noop
    }
  }

  async function editPreferences(action) {
    const configMap = [];
    for (let prop in config) {
      if (['config', 'configs'].includes(prop)) {
        continue;
      }
      configMap.push([prop, config[prop]]);
    }
    Dialog.info('You can break your installation if you are not careful! Consult the User Guide before making any changes!', 'WARNING', 'warning');
    const newConfig = Dialog.list(
      duskTitle, 
      'Make desired changes, then select each item you wish to commit and press OK. (Hold CTRL for multiple.)', 
      configMap, 
      ['Option', 'Value'], 
      {
        editable: true,
        height: 768,
        width: 500,
        multiple: true,
        printColumn: 'ALL'
      }
    );

    if (!newConfig) {
      return;
    }

    let writeOut = '';
    let splitConfig = newConfig.split('|');
    if (splitConfig.length >= 2) {
      writeOut += '# Modified by user\n';
      for (let i = 0; i < splitConfig.length; i += 2) {
        writeOut += `${splitConfig[i]}=${splitConfig[i + 1]}\n`;
      }
    }
    writeOut += '\n# Unmodified properties\n';
    for (let prop in config) {
      if (['config', 'configs'].includes(prop)) {
        continue;
      } else if (!splitConfig.includes(prop)) {
        writeOut += `${prop}=${config[prop]}\n`;
      }
    }

    const saveStatus = await Dialog.textInfo(writeOut, 'Update Configuration?', { 
      checkbox: 'I understand mistakes can break my installation.',
      width: 500,
      height: 600
    });

    if (saveStatus === 0) {
      const oldPath = path.join(program.datadir, 'config.old-' + Date.now());
      const newPath = path.join(program.datadir, 'config');
      const oldConf = fs.readFileSync(newPath);
      const newConf = writeOut;

      fs.writeFileSync(oldPath, oldConf);
      fs.writeFileSync(newPath, newConf);

      Dialog.info(
        `New settings saved to ${newPath}. Old settings were backed up to ${oldPath}.

You must restart dusk for the changes to take effect.`, duskTitle, 'info');
    }
  }

  function viewDebugLogs(action) {
    _dusk(['--logs', '--gui']);    
  }

  function disconnectAndExit(action) {
    const confirm = Dialog.info('You will be disconnected from dusk.', 'Exit?', 'question');
    if (confirm.status === 0) {
      exitGracefully();
    }
  }

  return {
    tray,
    NET_STATUS_CONNECTING,
    NET_STATUS_LISTENING,
    NET_STATUS_CONNECTED,
    FUSE_STATUS_MOUNTED,
    FUSE_STATUS_NOT_MOUNTED,
    FUSE_STATUS_MOUNTING
  };
};

module.exports = _init;
