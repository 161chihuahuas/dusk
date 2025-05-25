'use strict';

const path = require('node:path');
const usb = require('usb');
const drivelist = require('drivelist');
const inquirer = require('inquirer').default;
const dusk = require('../index.js');
const { mkdirSync } = require('node:fs');
const Dialog = require('../lib/zenity.js');

const dialogTitle = '🝰 dusk ~ SHOES '

module.exports.shred = function(dagEntry, program, config, exitGracefully) {
  

  return new Promise(async (resolve, reject) => {
    // take a shard array and shoesmanifest and distribute the shards onto
    // shoes usbs through interactive prompt
    const setupQs = [
      {
        type: 'number',
        name: 'numDrives',
        message: 'How many USB drives are we shredding to (excluding this one)?'
      }
    ];

    let setup;

    if (program.gui) {
      setup = { 
        numDrives: Dialog.scale(setupQs[0].message, dialogTitle, {
          value: 3,
          minValue: 3,
          maxValue: 30
        }) 
      };
    } else {
      setup = await inquirer.prompt(setupQs);
    }

    const shardsPerUsb = Math.ceil(dagEntry.shards.length / setup.numDrives);
    
    let datadir, storage;

    const user0prompt = `You are USER 0, which means this data will be encrypted for you and only unlockable using the dusk USB that is CURRENTLY inserted.
   
If you need other users to be able to unlock this  file, repeat this process for each user - starting   with THEIR dusk USB from the beginning.
    `;

    if (program.gui) {
      Dialog.info(user0prompt, dialogTitle, 'info');
    }

    console.log(user0prompt);

    for (let i = 0; i < dagEntry.shards.length; i++) {
      const shard = dagEntry.shards[i];
      const hash = dusk.utils.hash160(shard).toString('hex');
      
      console.log('');
      if (i % shardsPerUsb === 0) {
        if (i + 1 > setup.numDrives) {
          if (program.gui) {
            Dialog.info('Okay, time for USER 0 to finish the process. Ready?', 
              dialogTitle, 'info');
          }
          console.log(`  Ok, USER 0, it's you again to finish the process.`);
        } else {
          if (program.gui) {
            Dialog.info(`Ready USER ${i + 1}?`, dialogTitle, 'info');
          }
          console.log(`  I'm ready for USER ${i + 1}.`);
        }
        console.log('');
        const mnt = await module.exports.mount(program, config, exitGracefully);
        datadir = mnt.datadir;
        storage = mnt.storage;
      }

      function putShard(storage, hash, shard) {
        return new Promise((resolve, reject) => {
          storage.put(hash, {
            value: shard,
            timestamp: Date.now(),
            publisher: Buffer.alloc(20).fill(0)
          }, {}, (err) => {
            if (err) {
              return reject(err);
            }

            resolve();
          });
        });
      }

      await putShard(storage, hash, shard);
    }

    if (program.gui) {
      Dialog.notify('USB sneakernet created!', dialogTitle);
    }
    console.log('');
    console.log('  All finished! USER 0, you can retrace this file by running:');
    console.log('    [ dusk --retrace --usb]');
    console.log('');

    resolve();
  });
};

module.exports.retrace = function(meta, program, config, exitGracefully) {
  return new Promise(async (resolve, reject) => {
    let drivesChecked = 0;
    let setup;

    const shardMap = {};
    const setupQs = [
      {
        type: 'number',
        name: 'numDrives',
        message: 'How many dusk USBs are we retracing from?'
      }
    ];
    
    const user0prompt = `You are USER 0, which means this data will be decrypted by you at the end of this process.
  
I will use the key located on the dusk USB that is CURRENTLY inserted.`;

    if (program.gui) {
      setup = { 
        numDrives: Dialog.scale(setupQs[0].message, dialogTitle, {
          value: 3,
          minValue: 3,
          maxValue: 30
        }) 
      };
      Dialog.info(user0prompt, dialogTitle, 'info');
    } else {
      setup = await inquirer.prompt(setupQs);
    }

    console.log(user0prompt);

    while (drivesChecked < setup.numDrives) {
      if (Object.keys(shardMap).length >= meta.l.length - meta.p) {
        /*let keepGoing;

        if (program.gui) {
          keepGoing = {
            yes: Dialog.info(
              `I have enough parity information to retrace this file. ♥ 

Would you like to keep going anyway?`, 
              dialogTitle, 
              'question'
            );
          }
        } else {
          console.log('  I have enough information to retrace already ♥ ');
          console.log('');
          keepGoing = await inquirer.prompt({
            type: 'confirm',
            name: 'yes',
            message: 'Do you want to keep going anyway?'
          });
        }

        if (!keepGoing.yes) {
          */break;/*
        }*/
      }
      
      if (program.gui) {
        Dialog.info(
          `I'm ready to retrace the file. It doesn't matter which order you give me USB drives.

I will tell you when I have enough data. ♥`, 
          dialogTitle, 
          'info'
        );
      }

      console.log('');
      console.log('  Ok, I\'m ready to retrace. It doesn\'t matter');
      console.log('  what order we go in, so decide amongst yourselves.');
      console.log('');
      const mnt = await module.exports.mount(program, config, exitGracefully);

      let datadir = mnt.datadir;
      let storage = mnt.storage;
      let foundParts = 0;
 
      function getShard(storage, hash) {
        return new Promise((resolve, reject) => {
          storage.get(hash, {
          }, (err, item) => {
            if (err) {
              return reject(err);
            }

            resolve(Buffer.from(item.value, 'hex'));
          });
        });
      }

      for (let i = 0; i < meta.l.length; i++) {
        const hash = meta.l[i];

        console.log(hash, storage)
        if (storage._exists(hash)) {
          shardMap[meta.l[i]] = await getShard(storage, hash);     
          foundParts++;
        }
      }

      if (program.gui) {
        Dialog.notify(`${foundParts} recovered part(s) from USB #${drivesChecked+1}`, dialogTitle);
      }
      console.log(`  I found ${foundParts} parts on this dusk USB.`);
      console.log('');
      drivesChecked++;
    }
    
    const foundPieces = Object.keys(shardMap).length;
    const missingPieces = meta.l.length - foundPieces;
    
    console.log(`  I will retrace with ${foundPieces} of ${foundPieces + missingPieces} total parts`);
    console.log('');
    resolve(meta.l.map(l => shardMap[l] || null));
  });
};

module.exports.init = function(program, config) {
  return new Promise((resolve, reject) => {
    const shoesMetaPath = path.join(program.datadir, 'dusk.dag');
    mkdirSync(shoesMetaPath, { recursive: true });
    console.log('\n  [ using dusk USB ♥ ] ');
    resolve();
  });
}
;
module.exports.mount = function(program, config, exitGracefully) {
  return new Promise(async (resolve, reject) => {
    console.log('  [ Eject and remove any dusk USBs ... ]');
    console.log('');
    
    let ejected;

    if (program.gui) {
      ejected = { yes: Dialog.info(
        'Eject and remove any USB drives before proceeding. Are you ready?', 
        dialogTitle, 'question').status === 0 };
    } else {
      ejected = await inquirer.prompt({
        type: 'confirm',
        name: 'yes',
        message: 'Ready?'
      });
    }

    if (!ejected.yes) {
      if (program.gui) {
        Dialog.info('Eject USB drives and try again.', dialogTitle, 'error');
      }
      console.error('Eject dusk USB and try again.');
      exitGracefully();
    }

    const drives = (await drivelist.list()).map(d => d.device);
    let progress = program.gui 
      ? Dialog.progress('Insert your USB drive. I will wait for you ♥ ...',
        dialogTitle, { pulsate: true, noCancel: true })
      : null;

    console.log('');
    console.log('  [ Insert your dusk USB ] ');
    console.log('  [ I will wait for you  ♥ ... ]');
    console.log('');

    usb.usb.once('attach', async (device) => {
      let confirm;

      if (program.gui) {
        progress.progress(100);
        confirm = {
          inserted: Dialog.info(
            'I detected a new USB device, did you insert it?',
            dialogTitle,
            'question'
          ).status === 0
        };
      } else {
        confirm = await inquirer.prompt([{
          type: 'confirm',
          name: 'inserted',
          message: 'I detected a new usb device, did you insert a drive?'
        }]);
      }

      if (!confirm.inserted) {
        if (program.gui) {
          Dialog.info('I was not able to reliably detect the USB drive', 'Sorry', 'error');
        }
        console.warn('That\'s sus, friend, I\'m going to abort this.');
        exitGracefully();
      }

      if (program.gui) {
        confirm = {
          mounted: Dialog.info(
            'Okay, make sure it is mounted. Does it open in your file manager?',
            dialogTitle,
            'question'
          ).status === 0
        };
      } else {
        confirm = await inquirer.prompt([{
          type: 'confirm',
          name: 'mounted',
          message: 'Okay, make sure it\'s mounted. Does it open in your file manager?'
        }]);
      }

      if (!confirm.mounted) {
        if (program.gui) {
          Dialog.info('Try a different USB drive and start over.', 'Sorry', 'error');
        }
        console.warn('Try a different usb drive and start over.');
        exitGracefully();
      }

      const newDrives = (await drivelist.list()).map(d => d.device);
      const drive = newDrives.filter(d => {
        return !drives.includes(d);
      }).pop();

      if (!drive) {
        if (program.gui) {
          Dialog.info('I was not able to find the new USB drive. Try again?', 'Sorry', 'error');
        }
        console.error('I wasn\'t able to find the new USB drive, sorry.');
        exitGracefully();
      }
      
      let datadir;
      const devices = (await drivelist.list());

      for (let i = 0; i < devices.length; i++) {
        if (drive !== devices[i].device) {
          continue;
        }
        let mnt = devices[i].mountpoints.shift()
        if (mnt) {
          datadir = mnt.path;
        }
      }

      if (!datadir) {
        if (program.gui) {
          Dialog.info('I was not able to find the mount point. Try again?', 'Sorry', 'error');
        }
        console.error('I wasn\'t able to find the mount point, sorry.');
        exitGracefully();
      }

      console.log(`  Using datadir: ${datadir}`);
      datadir = path.join(datadir, '.config/dusk');

      resolve({
        datadir,
        storage: new dusk.Storage(path.join(datadir, 'dusk.dat'))
      });
    });
  });
};
