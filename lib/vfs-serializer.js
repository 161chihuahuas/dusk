'use strict';

const utils = require('./utils');
const { basename } = require('node:path');
const { Readable } = require('node:stream');
const Link = require('./link');
const {
  VirtualFileSystem,
  VirtualFileSystemResource
} = require('webdav-server').v2;

class VirtualFileSystemSerializer {

  constructor(privkey, _duskbin, logger) {
    this._prv = privkey;
    this._duskbin = _duskbin;
    this.log = logger;
    this._hashdict = {};
  }

  uid() {
    return 'dusk_VirtualFileSystemSerializer-' + 
      require('./version').software;
  }

  serialize(fs, callback) {
    const resources = {};

    const _bufferToLink = (path, buffer) => {
      const filename = basename(path);
      this.log.info('converting %s to link', filename);
      this._hashdict[path] = utils.hash256(buffer);
      return new Promise((resolve, reject) => {
        let result = Buffer.from([]);
        const shredder = this._duskbin.createShredder(filename);
        shredder.on('error', reject);
        shredder.stdout.on('end', () => {
          resolve(result);
        });
        shredder.stdout.on('data', data => {
          result = Buffer.concat([result, data]);
          this.log.info('created new link for %s: %s', 
            filename, result.toString());
        });
        shredder.stderr.once('data', data => {
          reject(new Error(data.toString()));
        });
        this.log.info('shredding %s', filename);
        Readable.from(Buffer.from(buffer)).pipe(shredder.stdin);
      });
    }

    const _convertAll = () => {
      return new Promise(async (resolve) => {
        for (let path in fs.resources) {
          let { content, type } = fs.resources[path];

          resources[path] = JSON.parse(JSON.stringify(fs.resources[path]));

          if (content.length && type.isFile) {
            const isModified = !this._hashdict[path] || Buffer.compare(
              this._hashdict[path],
              utils.hash256(Buffer.concat(content))
            ) !== 0;
            
            if (!isModified) {
              //continue;
            } 

            try {
              this.log.info('scanning %s for dusk link', path);
              const l = new Link(Buffer.concat(content).toString());
              l.parse();
              l.validate();
              this.log.info('%s has not been modified, skipping', path);
            } catch (e) {
              this.log.warn('%s was modified or created, reshredding (%s)', 
                path, e.message);
              resources[path].content = [
                (await _bufferToLink(path, Buffer.concat(content)))
                  .toJSON().data
              ];
              resources[path].size = resources[path].content[0].length;
            }
          }
        }

        resolve(resources);
      });
    }
   
    this.log.info('serializing virtual file system');
    _convertAll().then((resources) => {
      callback(null, { resources });
    }, callback);
  }

  unserialize(data, callback) {
    this.log.info('unserializing virtual file system, this may take a moment');
    const fs = new VirtualFileSystem(this);

    const _linkToBuffer = (link) => {
      this.log.info('converting %s to buffer', link);
      return new Promise((resolve, reject) => {
        let result = Buffer.from([]);
        const retracer = this._duskbin.createRetracer(this._prv);
        retracer.on('error', reject);
        retracer.stdout.on('end', () => {
          this.log.info('created new buffer for %s', link);
          resolve(result);
        });
        retracer.stdout.on('data', data => {
          result = Buffer.concat([result, data]);
        });
        retracer.stderr.once('data', data => {
          reject(new Error(data.toString()));
        });
        this.log.info('retracing %s', link);
        Readable.from(Buffer.from(link)).pipe(retracer.stdin);
      });

    };

    const _convertAll = () => {
      return new Promise(async (resolve) => {
        if (data.resources) {
          this.log.info('found vfs resources')
          for (let path in data.resources) {
            this.log.info('analysing %s', path);
          
            if (data.resources[path].type.isFile) {
              this.log.info('retracing resource from linked %s', path);
              const link = Buffer.from(data.resources[path]
                .content[0]).toString();
              
              this.log.info('creating virtual resource for %s from resource', 
                link);
              const buffer =  await _linkToBuffer(link);
              data.resources[path].content = [
                buffer
              ];
              data.resources[path].size = buffer.length;
              this._hashdict[path] = utils.hash256(buffer);
            }
            
            this.log.info('creating virtual resource for %s', path);
            fs.resources[path] = new VirtualFileSystemResource(
              data.resources[path]
            );
          }
        } else {
          this.log.info('found vfs data');
          for (let path in data) {     
            if (data[path].type.isFile) {
              this.log.info('creating virtual resource from link %s', path);
              const link = Buffer.from(data[path].content[0].data).toString();

              this.log.info('creating virtual resource for %s from data', link);
              const buffer =  await _linkToBuffer(link);
              data[path].content = [
                buffer
              ];
              data[path].size = buffer.length;
              this._hashdict[path] = utils.hash256(buffer);
            }

            this.log.info('creating virtual resource for %s', path);
            fs.resources[path] = new VirtualFileSystemResource(data[path]);
          }
        }

        resolve(fs);
      });
    };

    _convertAll().then(fs => {
      callback(null, fs);
    }, callback);
  }

}

module.exports = VirtualFileSystemSerializer;
