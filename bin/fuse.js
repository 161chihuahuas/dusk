'use strict';

const fs = require('node:fs');
const Fuse = require('fuse-native');
const { execSync } = require('node:child_process');
const { join, extname } = require('node:path');

function _init(mnt, datadir) {
  return new Promise(async (resolve, reject) => {
    const ops = {
      readdir: function (path, cb) {
        if (path === '/') {
          return fs.readdir(join(datadir, 'dusk.meta'), (err, list) => {
            if (err) {
              return cb(1);
            }
            cb(0, list.filter(f => extname(f) === '.duskbundle'));
          });
        }
        return cb(Fuse.ENOENT)
      },
      getattr: function (path, cb) {
        if (path === '/') {
          return fs.stat(datadir, (err, stat) => {
            if (err) {
              return cb(1);
            }
            cb(0, stat);
          })
        }
        return cb(Fuse.ENOENT)
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
        fs.unlink(join(datadir, 'dusk.meta', path), err => cb(err ? 1 : 0));
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
