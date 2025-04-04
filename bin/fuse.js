'use strict';

const fs = require('node:fs');
const { vol, fs: memfs } = require('memfs');
const Fuse = require('fuse-native');
const { execSync, fork } = require('node:child_process');
const { join, extname, basename } = require('node:path');
const { randomBytes } = require('node:crypto');
const { tmpdir } = require('node:os');

function _dusk(args) {
  return fork(join(__dirname, 'dusk.js'), args);
}

function errno(code) {
  return Fuse.errno(code);
}

const FUSE_DIRECT_MAPPING = [
  'chmod', 
  'chown', 
  'link', 
  'mkdir', 
  'open', 
  'readdir',
  'readlink', 
  'rmdir', 
  'rename', 
  'symlink', 
  'unlink'
];

const FUSE_NONSTD_MAPPING = [
  'fuse_access', 
  'create', 
  'destroy', 
  'flush', 
  'fsyncdir',                    
  'getxattr', 
  'init', 
  'listxattr', 
  'mknod', 
  'opendir',
  'releasedir', 
  'removexattr', 
  'setxattr', 
  'statfs'
];

const FDMAP = {};

const OPS = {

  readdir(path, cb) {
    console.log('readdir(%s)', path)
    memfs.readdir(path, (err, dir) => {
      if (err) {
        cb(Fuse.ENOENT, [], []);
      } else {
        cb(0, dir, dir.map(p => p.statSync));
      }
    });
  },

  getattr(path, cb) {
    console.log('gettattr(%s)', path)
    memfs.stat(path, (err, stats) => {
      if (err) {
        return cb(Fuse.ENOENT);
      }
      cb(0, stats);
    });
  },

  read(path, fd, buffer, length, position, cb) {
    const data = memfs.readFileSync(path);
    
    if (position >= data.length) {
      return cb(0);
    } // done
    
    const part = data.slice(position, position + length);
    
    part.copy(buffer); // write the result of the read to the result buffer
    cb(part.length);
  },

  async write(path, fd, buffer, length, position, cb) {
    const bytesWritten = memfs.writeSync(fd, buffer, { position });

    if (bytesWritten < 4096) {
      await _shred(memfs.readFileSync(path), path, OPS.secret);
    }

    cb(bytesWritten);
  },

  open(path, flags, cb) {
    console.log('open(%s, %s)', path, flags);
    memfs.open(path, flags, (err, fd) => {
      if (err) {
        return cb(Fuse.ENOENT);
      }

      FDMAP[path] = fd;
      cb(0, fd);
    });
  },

  release(path, fd, cb) {
    console.log('release(%s, %s)', path, fd)
    memfs.close(fd, (err) => {
      if (err) {
        return cb(Fuse.ENOENT);
      }

      FDMAP[path] = 0;
      cb(0);
    });
  },

  create(path, mode, cb) {
    console.log('create(%s, %s)', path, mode)
    memfs.open(path, 'w+', (err, fd) => {
      if (err) {
        return cb(Fuse.ENOENT);
      }
      FDMAP[path] = fd;
      cb(0, fd);
    });
  },

  rename(src, dest, cb) {
    console.log('rename(%s, %s)', src, dest)
    memfs.rename(src, dest, (err) => {
      if (err) {
        return cb(Fuse.ENOENT);
      }
      const isDuskBundle = fs.existsSync(join(OPS.root, `${src}.duskbundle`));

      fs.rename(
        join(OPS.root, isDuskBundle ? `${src}.duskbundle` : src),
        join(OPS.root, isDuskBundle ? `${dest}.duskbundle` : dest),
        (err) => {
          if (err) {
            return cb(Fuse.ENOENT);
          }
          cb(0);
        }
      )
    });
  },

  unlink(path, cb) {
    memfs.unlink(path, err => {
      if (err) {
        return cb(Fuse.ENOENT);
      }
      cb(0);
    });
  },

  mkdir(path, mode, cb) {
    console.log('mkdir(%s, %s)', path, mode)
    memfs.mkdir(path, (err) => {
      if (err) {
        return cb(Fuse.ENOENT);
      }
      cb(0);
    });
  },

  rmdir(path, cb) {
    console.log('rmdir(%s)', path)
    memfs.rmdir(path, (err) => {
      if (err) {
        return cb(Fuse.ENOENT);
      }
      cb(0);
    });
  }

}

function syncFs(root, secret, exitGracefully) {
  return new Promise(async (resolve, reject) => {
    const list = fs.readdirSync(root);
    const skel = {};

    console.log('syncing virtual filesystem...');
    
    for (let i = 0; i < list.length; i++) {
      const isDirectory = fs.statSync(join(root, list[i])).isDirectory();
      const isDuskBundle = isDirectory && extname(list[i]) === '.duskbundle';
      const isHidden = list[i].charAt(0) === '.';

      if (isDirectory && !isDuskBundle) {
        skel[list[i]] = await syncFs(join(root, list[i]), secret, exitGracefully);
      } else if (isDuskBundle) {
        skel[list[i].split('.duskbundle')[0]] = skel[list[i]] || await _retrace(
          join(root, list[i]),
          secret
        );
      } 
    }

    resolve(skel);
  });
}

function _retrace(metaFilePath, privateKey) {
  const tmpfile = join(tmpdir(), `dusk.${randomBytes(8).toString('hex')}`);

  return new Promise((resolve, reject) => {
    const cmd = _dusk([
      '--retrace', metaFilePath,
      '--file-out', tmpfile,
      '--local',
      '--dht',
      '--with-secret', privateKey.toString('hex'),
      '--quiet',
      '--yes',
      '--quiet'
    ]);

    cmd.on('error', reject);
    cmd.on('close', code => code === 0 
      ? resolve(fs.readFileSync(tmpfile)) 
      : reject(new Error('Retrace command failed')));
  });
}

function _shred(buffer, outPath, privateKey) {
  fs.writeFileSync(join(tmpdir(), basename(outPath)), buffer);

  return new Promise((resolve, reject) => {
    const cmd = _dusk([
      '--shred', 
      '--file-in', join(tmpdir(), basename(outPath)),
      '--file-out', (OPS.root ? join(OPS.root, `${outPath}.duskbundle`) : ''),
      '--local',
      '--dht',
      '--lazy',
      '--with-secret', privateKey.toString('hex'),
      //'--quiet',
      '--yes'
    ]);

    cmd.on('error', reject);
    cmd.on('close', code => code === 0 
      ? resolve() 
      : reject(new Error('Shred command failed')));
  });
}

function mountFs(mnt, datadir, secret, exitGracefully) {
  const root = join(datadir, 'dusk.meta');

  return new Promise(async (resolve, reject) => {
    const fuseNativeBinPath = join(__dirname, '../node_modules/.bin/fuse-native');
    let isConfigured = false;

    try {
      const checkResult = execSync(`${fuseNativeBinPath} is-configured`);
      isConfigured = checkResult.toString().trim() === 'true';
    } catch (err) {
      return reject(err);
    }

    if (!isConfigured) {
      try {
        execSync(`pkexec ${fuseNativeBinPath} configure`);
      } catch (err) {
        return reject(err);
      }
    }

    OPS.secret = secret;
    OPS.root = root;

    const fuse = new Fuse(mnt, OPS, { 
      debug: true,
      force: true,
      mkdir: true
    });

    fuse.mount(async function(err) {
      if (err) {
        return reject(err);
      }
      
      vol.fromNestedJSON(await syncFs(root, secret, exitGracefully), '/');
      
      memfs.watch('/', {
        persistent: true,
        recursive: true
      }, async (eventType, filename) => {
        console.log('WATCH', eventType, filename)
        switch (eventType) {
          case 'change':

            break;
          case 'rename':
            if (memfs.existsSync(`/${filename}`) && memfs.statSync(`/${filename}`).isDirectory()) {
              // directory created
              const directory = join(root, filename);
              const bundle = `${directory}.duskbundle`;

              try {
                if (!fs.existsSync(bundle)) {
                  fs.mkdirSync(directory, { recursive: true });
                }
              } catch (err) {
                console.error(err);
              }
            } else if (!memfs.existsSync(filename)) {
              // file not created / or deleted
              
              // did we move/rename the file

              // did we delete the file?
              try {
                const directory = join(root, basename(filename));
                const bundle = `${directory}.duskbundle`;
                if (fs.existsSync(directory)) {
                  fs.rmdirSync(directory, { recursive: true });
                }
                if (fs.existsSync(bundle)) {
                  fs.rmdirSync(bundle, { recursive: true });
                }
              } catch (err) {
                console.error(err);
              }
            }
            break;
          default:
            //noop
        } 
      });

      resolve(memfs);
    })     
  });
}

module.exports = mountFs;
