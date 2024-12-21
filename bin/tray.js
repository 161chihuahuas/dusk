'use strict';

const Tray = require('systray').default;
const { exec } = require('node:child_process');
const path = require('node:path');
const Dialog = require('../lib/zenity');
const fs = require('node:fs');

function _dusk(args) {
  return new Promise((resolve, reject) => {
    exec(path.join(__dirname, 'dusk.js') + ' ' + args.join(' '), (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      } else if (stderr) {
        return reject(new Error(stderr));
      } else {
        return resolve(stdout);
      }
    });
  });
}

async function _init(rpc, program, config, exitGracefully) {
  const tray = new Tray({
    menu: {
      icon: fs.readFileSync(path.join(__dirname, '../assets/images/favicon.png')).toString('base64'),
      title: '🝰 dusk',
      tooltip: '🝰 dusk',
      items: [
        {
          title: '🔄  Connecting...', // 🔐  Connected | ⌚  Waiting for connections
          tooltip: 'Status',
          checked: false,
          enabled: false
        },
        {
          title: '🔗  Link peer device',
          enabled: true,
          checked: false
        },
        {
          title: '🗂  Mount virtual folders',
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
          enabled: false,
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
      case 0:

        break;
      case 1:

        break;
      case 2:

        break;
      case 3:

        break;
      case 4:

        break;
      case 5:
        const confirm = Dialog.info('You will be disconnected from dusk.', 'Exit?', 'question');
        if (confirm.status === 0) {
          exitGracefully();
        }
        break;
      default:
        // noop
    }
})}

module.exports = _init;
