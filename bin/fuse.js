'use strict';

const Fuse = require('fuse-native');

function _init(mnt) {
  return new Promise(async (resolve, reject) => {
    const ops = {
      readdir: function (path, cb) {
        if (path === '/') return cb(null, ['test'])
        return cb(Fuse.ENOENT)
      },
      getattr: function (path, cb) {
        if (path === '/') return cb(null, stat({ mode: 'dir', size: 4096 }))
        if (path === '/test') return cb(null, stat({ mode: 'file', size: 11 }))
        return cb(Fuse.ENOENT)
      },
      open: function (path, flags, cb) {
        return cb(0, 42)
      },
      release: function (path, fd, cb) {
        return cb(0)
      },
      read: function (path, fd, buf, len, pos, cb) {
        var str = 'hello world'.slice(pos, pos + len)
        if (!str) return cb(0)
        buf.write(str)
        return cb(str.length)
      }
    };

    // TODO Fuse.isConfigured? pkexec
     
    const fuse = new Fuse(mnt, ops, { debug: true });

    fuse.mount(function(err) {
      if (err) {
        return reject(err);
      }
      resolve();
    })
  });
}

module.exports = _init;
