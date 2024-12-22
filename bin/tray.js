'use strict';

const Tray = require('systray').default;
const { fork } = require('node:child_process');
const path = require('node:path');
const Dialog = require('../lib/zenity');
const fs = require('node:fs');

function _dusk(args) {
  return fork(path.join(__dirname, 'dusk.js'), args);
}

function _init(rpc, program, config, exitGracefully) {
  const STATUS_CONNECTING = { 
    type: 'update-item', 
    seq_id: 0, 
    item: { 
      checked: false, 
      enabled: false, 
      title: '🔄  Connecting...' 
    }
  };
  const STATUS_CONNECTED = { 
    type: 'update-item', 
    seq_id: 0, 
    item: {
      checked: false, 
      enabled: false, 
      title: ' 🔐  Connected' 
    }
  };
  const STATUS_LISTENING = { 
    type: 'update-item', 
    seq_id: 0, 
    item: {
      checked: false, 
      enabled: false, 
      title: '⌚  Waiting for a link...' 
    }
  };

  const FUSE_NOT_MOUNTED = {
    type: 'update-item',
    seq_id: 2,
    item: {
      title: '🗂  Mount virtual folders',
      enabled: true,
      checked: false
    }
  };
  const FUSE_MOUNTED = {
    type: 'update-item',
    seq_id: 2,
    item: {
      title: '🗂  Unmount virtual folders',
      enabled: true,
      checked: false
    }
  };
  const FUSE_MOUNTING = {
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
        STATUS_CONNECTING.item,
        {
          title: '🔍  Show network info',
          enabled: true,
          checked: false
        },
        {
          title: '🔗  Link peer device',
          enabled: true,
          checked: false
        },
        FUSE_NOT_MOUNTED.item, 
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
        showNetworkInfo(action);
        break;
      case 2: // Link peer device
        linkPeerDevice(action);
        break;
      case 3: // Mount virtual folders
        toggleMountVirtualFolders(action);
        break;
      case 4: // Edit preferences
        editPreferences(action);
        break;
      case 5: // View debug logs
        viewDebugLogs(action);
        break;
      case 6: // Disconnect and exit
        disconnectAndExit(action); 
        break;
      default:
        // noop
    } 
  });

  function showNetworkInfo(action) {

  }

  function linkPeerDevice(actions) {

  }

  function toggleMountVirtualFolders(action) {

  }

  function editPreferences(actions) {

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
    STATUS_CONNECTING,
    STATUS_LISTENING,
    STATUS_CONNECTED
  };
};

module.exports = _init;
