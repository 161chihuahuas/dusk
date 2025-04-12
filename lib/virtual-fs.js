'use strict';

const fs = require('node:fs/promises');
const utils = require('./utils.js');
const path = require('node:path');
const { FileSystem } = require('ftp-srv');

class VirtualFS extends FileSystem {
  constructor(connection, config, secret, pubkey) {
    super(connection, { 
      root: config.MetadataDirectory, 
      cwd: '/' 
    });
    this._virt = {};
    this._sk = secret;
    this._pk = pubkey;
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
      
      tree.stat = await fs.stat(path.resolve(dir));
      tree.data = {};

      for (let i = 0; i < list.length; i++) {
        const stat = await fs.stat(path.join(dir, list[i]));
        const isDir = stat.isDirectory();
        const isBundle = isDir && path.extname(list[i]) === '.duskbundle';

        if (!isDir) {
          continue;
        }

        stat.name = list[i];

        if (!isBundle) {
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

      resolve(tree);
    });
  }

  _statBundle(bundlePath) {
    return new Promise(async (resolve, reject) => {
      const contents = await fs.readdir(bundlePath);

      let meta;

      for (let i = 0; i < contents.length; i++) {
        if (path.extname(contents[i]) === '.meta') {
          meta = path.join(bundlePath, contents[i]);
        }
      }

      if (!meta) {
        reject(new Error('Invalid bundle'));
      }

      const data = JSON.parse(utils.decrypt(
        this._sk.toString('hex'),
        await fs.readFile(meta)).toString('utf8'));

      const metastats = await fs.stat(meta);
      metastats.name = data.n;
      metastats.size = data.s.o;

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

      const values = Object.values(cursor.data).map(v => v.stat);
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
        return reject(e);
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


    });
  }

  read(fileName) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();


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
    return new Promise(async (resolve, /*reject*/) => {
      const bundlePathFrom = path.join(this.root, fromPath + '.duskbundle');
      const bundlePathTo = path.join(this.root, toPath + '.duskbundle');

      let isBundle;

      try {
        isBundle = await fs.stat(bundlePathFrom);
      } catch (err) {
        isBundle = false;
      }

      if (isBundle) {
        await fs.rename(bundlePathFrom, bundlePathTo);
      } else {
        await fs.rename(
          path.join(this.root, fromPath),
          path.join(this.root, toPath)
        );
      }

      await this._refresh();
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
