'use strict';

const fs = require('node:fs');
const Fuse = require('fuse-native');
const { execSync } = require('node:child_process');
const { join, extname } = require('node:path');

function _init(mnt, datadir) {
  return new Promise(async (resolve, reject) => {
    const ops = {
      readdir: function(path, cb) {
        fs.readdir(join(datadir, 'dusk.meta', path), (err, list) => {
          if (err) {
            return cb(1);
          }
          cb(0, list.filter(f => {
            return fs.statSync(join(datadir, 'dusk.meta', f)).isDirectory();
          }).map(f => {
            if (extname(f) === '.duskbundle') {
              return f.split('.duskbundle')[0];
            } else {
              return f;
            }
          }));
        });
      },
      getattr: function (path, cb) {
        const realPath = join(datadir, 'dusk.meta', path);
        const isBundle = fs.existsSync(`${realPath}.duskbundle`);

        let statPath = realPath;

        if (isBundle) {
          statPath = join(
            `${realPath}.duskbundle`, fs.readdirSync(`${realPath}.duskbundle`)[0]);

        }

        return fs.stat(statPath, (err, stat) => {
          if (err) {
            return cb(1);
          }
          cb(0, isBundle
            ? { ...stat }
            : { ...stat });
        });
      },
      open: function (path, flags, cb) {
        return cb(0, 161);
      },
      release: function (path, fd, cb) {
        return cb(0);
      },
      read: function (path, fd, buf, len, pos, cb) {
        // retrace duskbundle from network 
        cb(Fuse.ENOENT);
      },
      write: function(path, fd, buf, len, pos, cb) {
        // shred to duskbundle
        cb(Fuse.ENOENT);
      },
      unlink: function(path, cb) {
        fs.unlink(join(datadir, 'dusk.meta', `${path}.duskbundle`), err => cb(err ? 1 : 0));
      },
      mkdir: function(path, mode, cb) {
        fs.mkdir(join(datadir, 'dusk.meta', path), err => cb(err ? 1 : 0));
      },
      rmdir: function(path, cb) {
        fs.rmdir(join(datadir, 'dusk.meta', path), err => cb(err ? 1 : 0));
      }
    };

    const fuseconfigpath = join(__dirname, '../node_modules/.bin/fuse-native');

    Fuse.isConfigured((err, isConfigured) => {
      if (err) {
        return reject(err);
      }

      if (!isConfigured) {
        try {
          execSync(`pkexec ${fuseconfigpath} configure`);
        } catch (err) {
          return reject(err);
        }
      }

      const fuse = new Fuse(mnt, ops, { 
        debug: true,
        force: true,
        mkdir: true
      });

      fuse.mount(function(err) {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    })     
  });
}

module.exports = _init;
