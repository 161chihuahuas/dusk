'use strict';

const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const utils = require('./utils.js');
const path = require('node:path');
const os = require('node:os');
const { splitSync } = require('node-split');
const { FileSystem } = require('ftp-srv');
const DAGEntry = require('./dag-entry.js');
const reedsol = require('./reed-solomon.js');

class VirtualFS extends FileSystem {
  constructor(connection, config, secret, pubkey, rpc) {
    super(connection, { 
      root: config.MetadataDirectory, 
      cwd: '/' 
    });
    this._virt = {};
    this._sk = secret;
    this._pk = pubkey;

    this.rpc = rpc;
  }

  _refresh() {
    return new Promise(async (resolve, reject) => {
      try {
        this._virt = await this._buildVirtualTree(this._root);
      } catch (e) {
        return reject(e);
      }
      resolve();
    });
  }

  _buildVirtualTree(dir) {
    const tree = { type: 'dir' };

    return new Promise(async (resolve, /*reject*/) => {
      const list = await fs.readdir(dir);
     
      try {
        tree.stat = await fs.stat(path.resolve(dir));
        tree.stat.type = 'directory';
        tree.data = {};

        for (let i = 0; i < list.length; i++) {
          const stat = await fs.stat(path.join(dir, list[i]));
          const isDir = stat.isDirectory();
          const isBundle = isDir && path.extname(list[i]) === '.duskbundle';

          if (!isDir) {
            stat.type = 'file';
            continue;
          }

          stat.name = list[i];

          if (!isBundle) {
            stat.type = 'directory';
            tree.data['/' + list[i]] = { 
              stat, 
              type: 'dir', 
              data: await this._buildVirtualTree(path.join(dir, list[i])) 
            };
          } else {
            tree.data['/' + list[i].split('.duskbundle')[0]] = 
              await this._statBundle(path.join(dir, list[i]));
          }
        }
      } catch (e) {
        console.error(e);
      }

      resolve(tree);
    });
  }

  _statBundle(bundlePath) {
    return new Promise(async (resolve, reject) => {
      let contents;

      try {
        contents = await fs.readdir(bundlePath);
      } catch (err) {
        return reject(err);
      }

      let meta;

      for (let i = 0; i < contents.length; i++) {
        if (path.extname(contents[i]) === '.meta') {
          meta = path.join(bundlePath, contents[i]);
        }
      }

      if (!meta) {
        return reject(new Error('Invalid bundle'));
      }

      let data, metastats;

      try {
        data = JSON.parse(utils.decrypt(
          this._sk.toString('hex'),
          await fs.readFile(meta)).toString('utf8'));

        metastats = await fs.stat(meta);
        metastats.name = data.n;
        metastats.size = data.s.o;
      } catch (err) {
        return reject(err);
      }

      metastats.type = 'bundle';
      resolve({ stat: metastats, type: 'bundle', data });
    });
  }

  _walkVirtualTree(toPath) {
    return new Promise((resolve, reject) => {
      const resolvedPath = path.resolve(this.cwd, toPath);

      if (resolvedPath === '/') {
        return resolve(this._virt);
      }

      let splitPath = resolvedPath.split('/')
        .filter(v => !!v);
      
      let cursor = this._virt;

      for (let i = 0; i < splitPath.length; i++) {
        if (splitPath[i] === '/') {
          continue;        
        } else if (cursor.data['/' + splitPath[i]]) {
          cursor = cursor.data['/' + splitPath[i]].type === 'bundle'
            ? cursor.data['/' + splitPath[i]]
            : cursor.data['/' + splitPath[i]].data;
        } else {
          reject(new Error('Invalid path ' + toPath));
        }
      }

      resolve(cursor);
    });
  }

  currentDirectory() {
    return this.cwd;
  }

  get(fileName) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();
      let tree;

      try {
        tree = await this._walkVirtualTree(fileName);
      } catch (e) {
        return reject(e);
      }

      resolve(tree.stat);
    });
  }

  list(dirPath) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();
      
      let cursor;
      
      try {
        cursor = await this._walkVirtualTree(dirPath);
      } catch (e) {
        return reject(e);
      }

      const values = Object.values(cursor.data).map(v => v.stat).filter(s => !!s);
      resolve(values);
    });
  }

  chdir(dirPath) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();

      let tree;

      try {
        tree = await this._walkVirtualTree(dirPath);
      } catch (e) {
        return resolve(this.cwd);
      }

      const stat = tree.stat;

      if (stat.isDirectory()) {
        this.cwd = dirPath;
        resolve(this.cwd);
      } else {
        reject(new Error('Invalid path'));
      }
    });
  }

  mkdir(dirPath) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();

      try {
        await fs.stat(path.resolve(this.root, dirPath));
      } catch (err) {
        await fs.mkdir(path.join(this.root, dirPath));
        return resolve(path.resolve(this.cwd, dirPath));
      }

      reject(new Error('Path already exists'));
    });
  }

  write(fileName) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();
    
      try {
        await this._walkVirtualTree(fileName);
        return reject(new Error('File already exists'));
      } catch (e) {
        // noop
      }

      const rpc = this.rpc;
      const tmpfile = path.join(os.tmpdir(), utils.getRandomKeyString());
      const writeStream = createWriteStream(tmpfile);

      writeStream.on('error', (e) => reject(e));
      writeStream.on('close', async () => {
        writeStream.removeAllListeners('close');

        let entry;

        try {
          entry = await fs.readFile(tmpfile);
        } catch (err) {
          return reject(err);
        }

        const encryptedFile = utils.encrypt(this._pk, entry);
        const datedName = `${path.basename(fileName)}`;
        const dagEntry = await DAGEntry.fromBuffer(encryptedFile, entry.length);
        const meta = dagEntry.toMetadata(datedName || '');
        const metaEnc = utils.encrypt(this._pk, meta);
        const metaHash160 = utils.hash160(metaEnc).toString('hex');
        const bundleDir = path.join(this.root, `${datedName}.duskbundle`);

        try {
          await fs.mkdir(bundleDir);
          await fs.writeFile(path.join(bundleDir, 
            `${metaHash160}.meta`), metaEnc);
        } catch (err) {
          console.log(err)
          writeStream.end();
          await fs.rm(bundleDir, { recursive: true });
          return reject(err);
        }

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
          
          while (!success) {
            try {
              success = await storeLocal(dagEntry.shards[i].toString('hex'));
            } catch (e) {
              console.log(e)
            }
          }
        }

        writeStream.end();

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

        for (let i = 0; i < dagEntry.shards.length; i++) {
          let success;

          while (!success) {
            try {
              success = await storeNetwork(dagEntry.shards[i].toString('hex'));
            } catch (e) {
              return reject(e);
            }
          }
        } 
      });

      resolve({
        stream: writeStream,
        clientPath: path.resolve(this.cwd, fileName)
      });
    });
  }

  read(fileName) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();

      let metaData, cursor;

      try {
        cursor = await this._walkVirtualTree(fileName);
      } catch (err) {
        return reject(err);
      }
      
      let missingPieces = 0;
      let shards = [];
      let rpc = this.rpc;

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

      metaData = cursor.data;

      if (!metaData.l) {
        return reject(new Error('Invalid metadata?'));
      }

      for (let i = 0; i < metaData.l.length; i++) {
        let success;
        
        while (!success) {
          try {
            let shard = await getLocal(metaData.l[i].toString('hex'));
            shards.push(shard);
            success = true;
          } catch (e) {
            missingPieces++;
            shards.push(Buffer.alloc(DAGEntry.INPUT_SIZE));
            success = true;
          }
        }
      }

      if (missingPieces && missingPieces > metaData.p) {
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

          const emptyBuf = Buffer.alloc(DAGEntry.INPUT_SIZE);
          const currentShard = shards[i];

          if (currentShard && Buffer.compare(emptyBuf, currentShard) !== 0) {
            continue;
          }

          while (!success) {
            try {
              let shard = await findvalue(metaData.l[i].toString('hex'));
              shards[i] = shard;
              success = true;
            } catch (e) {
              missingPieces++;
              
              if (missingPieces > metaData.p) {
                return reject(new Error(
                  'too many missing shards to recover this file'));
              }

              shards[i] = (Buffer.alloc(DAGEntry.INPUT_SIZE));
              success = true;
            }
          }
        }
      }

      if (missingPieces) {
        shards = splitSync(await reedsol.encodeCorrupted(
          splitSync(Buffer.concat(shards), { 
            bytes: DAGEntry.INPUT_SIZE
          })), { bytes: DAGEntry.INPUT_SIZE });
      } 

      while (metaData.p--) {
        shards.pop();
      }

      const mergedNormalized = Buffer.concat(shards).subarray(0, metaData.s.a);
      const filename = path.join(os.tmpdir(), utils.getRandomKeyString());
      const decryptedFile = utils.decrypt(this._sk.toString('hex'), 
        mergedNormalized);
      const fileBuf = Buffer.from(decryptedFile);
      const trimmedFile = fileBuf.subarray(0, metaData.s.o);

      await fs.writeFile(filename, trimmedFile);
       
      const stream = createReadStream(filename);

      stream.on('error', err => {
        reject(err);
      });
      stream.on('close', async () => await fs.unlink(filename));

      resolve({
        stream,
        clientPath: path.resolve(this.cwd, fileName)
      });
    });
  }

  delete(delPath) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();

      let cursor;

      try {
        cursor = await this._walkVirtualTree(delPath);
      } catch (e) {
        return reject(e);
      }

      if (cursor.type === 'dir') {
        await fs.rm(path.join(this.root, delPath), { 
          recursive: true 
        });
      } else if (cursor.type === 'bundle') {
        await fs.rm(path.join(this.root, delPath + '.duskbundle'), { 
          recursive: true 
        });
      } else {
        return reject(new Error('Unknown cursor type'));
      }

      resolve();
    });
  }

  rename(fromPath, toPath) {
    return new Promise(async (resolve, reject) => {
      const bundlePathFrom = path.join(this.root, fromPath + '.duskbundle');
      const bundlePathTo = path.join(this.root, toPath + '.duskbundle');

      let isBundle;

      try {
        isBundle = await fs.stat(bundlePathFrom);
      } catch (err) {
        isBundle = false;
      }

      try {
        if (isBundle) {
          await fs.rename(bundlePathFrom, bundlePathTo);
        } else {
          await fs.rename(
            path.join(this.root, fromPath),
            path.join(this.root, toPath)
          );
        }

        await this._refresh();
      } catch (e) {
        return reject(e);
      }
      resolve();
    });
  }

  chmod(/*modPath*/) {
    return new Promise(async (resolve, /*reject*/) => {
      await this._refresh();
      resolve(); // noop
    });
  }

  getUniqueName(fileName) {
    return `${Date.now()}-${fileName}`;
  }
}

module.exports = VirtualFS;
