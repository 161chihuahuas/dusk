'use strict';

const fs = require('node:fs/promises');
const utils = require('./utils.js');
const path = require('node:path');
const { FileSystem } = require('ftp-srv');

class VirtualFS extends FileSystem {
  constructor(connection, config, secret) {
    super(connection, { 
      root: config.MetadataDirectory, 
      cwd: '/' 
    });
    this._virt = {};
    this._sk = secret;
  }

  _refresh() {
    return new Promise(async (resolve, reject) => {
      this._virt = await this._buildVirtualTree(this._root);
      resolve();
    });
  }

  _buildVirtualTree(dir) {
    const tree = { type: 'dir' };

    return new Promise(async (resolve, reject) => {
      const list = await fs.readdir(dir);
      
      tree.stat = await fs.stat(path.resolve(dir));
      tree.data = {};

      for (let i = 0; i < list.length; i++) {
        const stat = await fs.stat(path.join(dir, list[i]));
        const isDir = stat.isDirectory();
        const isBundle = path.extname(list[i]) === '.duskbundle';

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
          tree.data['/' + list[i].split('.duskbundle')[0]] = await this._statBundle(
            path.join(dir, list[i])
          );
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

      const data = JSON.parse(utils.decrypt(
        this._sk.toString('hex'),
        await fs.readFile(meta)).toString('utf8'));

      const metastats = await fs.stat(meta);
      const stat = {
        ...metastats,
        name: meta.n,
        size: meta.s.o
      };

      resolve({ stat, type: 'bundle', data });
    });
  }

  _walkVirtualTree(toPath) {
    const resolvedPath = path.resolve(this.cwd, toPath);

    if (resolvedPath === '/') {
      return this._virt;
    }

    let splitPath = resolvedPath.split('/');

    if (splitPath.length > 1) {
      splitPath.shift();
    }
    
    let cursor = this._virt;

    for (let i = 0; i < splitPath.length; i++) {
      if (!splitPath[i]) {
        continue;
      } else if (splitPath[i] === '/') {
        continue;        
      } else if (cursor.data['/' + splitPath[i]]) {
        cursor = cursor.data['/' + splitPath[i]].data;
      } else {
        continue;
      }
    }

    return cursor;
  }

  currentDirectory() {
    return this.cwd;
  }

  get(fileName) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();
      resolve(this._walkVirtualTree(fileName).stat);
    });
  }

  list(dirPath) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();
      const cursor = this._walkVirtualTree(dirPath);
      const values = Object.values(cursor.data.data || cursor.data).map(v => v.stat);
      resolve(values);
    });
  }

  chdir(dirPath) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();

      const tree = this._walkVirtualTree(dirPath);
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
      let stat;

      try {
        stat = await fs.stat(path.resolve(this.root, dirPath));
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

      const cursor = this._walkVirtualTree(delPath);

      if (cursor.type === 'dir') {
        await fs.rm(path.join(this.root, delPath), { recursive: true });
      } else if (cursor.type === 'bundle') {
        await fs.rm(path.join(this.root, delPath + '.duskbundle'), { recursive: true });
      } else {
        console.log(cursor)
      }

      resolve();
    });
  }

  rename(fromPath, toPath) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();


    });
  }

  chmod(modPath) {
    return new Promise(async (resolve, reject) => {
      await this._refresh();


    });
  }

  getUniqueName(fileName) {
    return `${Date.now()}-${fileName}`;
  }
}

module.exports = VirtualFS;
