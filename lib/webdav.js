'use strict';

const boscar = require('boscar');
const VirtualFS = require('./virtual-fs.js');
const webdav = require('webdav-server').v2;

class Resource {
  constructor(data) {
    if (!data) {
      this.props = new webdav.LocalPropertyManager();
      this.locks = new webdav.LocalLockManager();
    } else {
      this.props = data.props;
      this.locks = data.locks;
    }
  }
}

class Serializer {
  constructor() {

  }

  uid() {
    return 'duskvfsSerializer_1.0.0';
  }

  serialize(fs, callback) {
    callback(null, {
      resources: fs.resources,
      config: fs.config
    });
  }

  unserialize(serializedData, callback) {
    const fs = new FileSystem(serializedData.config);
    fs.resources = serializedData.resources;
    callback(null, fs);
  }
}

class FileSystem extends webdav.FileSystem {
  constructor(config) {
    super(new Serializer());
   
    this.config = config;
    this.resources = {
      '/': new Resource()
    };
  }

  _getRpcControl() {
    if (this.rpc) {
      return Promise.resolve(this.rpc);
    }
    return new Promise((resolve, reject) => { 
      const client = new boscar.Client();
      const config = this.config;

      if (parseInt(config.ControlPortEnabled)) {
        client.connect(parseInt(config.ControlPort));
      } else if (parseInt(config.ControlSockEnabled)) {
        client.connect(config.ControlSock);
      }

      client.on('ready', () => resolve(client));
      client.socket.on('close', () => {
      
      });
      client.on('error', err => {
        reject(err);
      });

      this.rpc = client;
    });
  }

  _getVirtualTree(rpc, callback) {
    if (this.vfs) {
      return callback(this.vfs);
    }

    this.vfs = new VirtualFS(
      {}, 
      this.config, 
      this.config.privkey,
      this.config.pubkey,
      rpc
    );
    callback(this.vfs);
  }

  getRealPath(path) {
    console.log('getRealPath', path)
    const sPath = path.toString();

    return {
      realPath: sPath,
      resource: this.resources[sPath]
    };
  }
    
  connect(callback) {
    console.log('connect')
    this._getRpcControl().then((rpc) => {
      this._getVirtualTree(rpc, callback); 
    }, (err) => {
      console.log('connect err', err)
      callback(err);
    });
  }

  _create(path, ctx, _callback) {
    console.log('_create', path)
    if (path.isRoot()) {
      return _callback(webdav.Errors.InvalidOperation);
    }

    const { realPath } = this.getRealPath(path);

    this.connect((c) => {
      const callback = (e) => {
        if (!e) {
          this.resources[path.toString()] = new Resource();
        } else if (e) {
          e = webdav.Errors.ResourceAlreadyExists;
        }

        c.end();
        _callback(e);
      };

      if (ctx.type.isDirectory) {
        c.mkdir(realPath, callback);
      } else {
        this._openWriteStream(path, {
          context: ctx.context,
          estimatedSize: 0,
          mode: null,
          targetSource: true
        }, (e, wStream) => {
          if (e) {
            return callback(e);
          }
          
          wStream.end(Buffer.alloc(0), callback)
        });
      }
    });
  }

  _delete(path, ctx, _callback) {
    console.log('_delete', path)
    if (path.isRoot()) {
      return _callback(webdav.Errors.InvalidOperation);
    }

    const { realPath } = this.getRealPath(path);

    this.connect((c) => {
      const callback = (e) => {
        if (!e) {
          delete this.resources[path.toString()];
        }

        c.end();
        _callback(e);
      }

      this.type(ctx.context, path, (e, type) => {
        if (e) {
          return callback(webdav.Errors.ResourceNotFound);
        }

        if (type.isDirectory) {
          c.rmdir(realPath, callback);
        } else {
          c.delete(realPath, callback);
        }
      });
    });
  }

  _openWriteStream(path, ctx, callback) {
    console.log('_openWriteStream', path)
    if (path.isRoot()) {
      return callback(webdav.Errors.InvalidOperation);
    }

    const { realPath, resource } = this.getRealPath(path);

    this.connect((c) => {
      const wStream = new Transform({
        transform(chunk, encoding, cb) {
          cb(null, chunk);
        }
      });
      c.put(wStream, realPath, (e) => {
        c.end();
      });
      callback(null, wStream);
    })
  }

  _openReadStream(path, ctx, callback) {
    console.log('_openReadStream', path)
    if (path.isRoot()) {
      return callback(webdav.Errors.InvalidOperation);
    }

    const { realPath } = this.getRealPath(path);

    this.connect((c) => {
      c.get(realPath, (e, rStream) => {
        if (e) {
          return callback(webdav.Errors.ResourceNotFound, null);
        }

        const stream = new Transform({
          transform(chunk, encoding, cb) {
            cb(null, chunk);
          }
        });

        stream.on('error', () => {
          c.end();
        });

        stream.on('finish', () => {
          c.end();
        });

        rStream.pipe(stream);
        callback(null, stream);
      });
    });
  }

  _size(path, ctx, callback) {
    console.log('_size', path)
    if (path.isRoot()) {
      return callback(webdav.Errors.InvalidOperation);
    }

    const { realPath } = this.getRealPath(path);

    this.connect((c) => {
      c.get(realPath).then(({ size }) => {
        callback(null, size);
      }, (e) => {
        callback(webdav.Errors.ResourceNotFound);
      })
    })
  }

  _lockManager(path, ctx, callback) {
    console.log('_lockManager', path)
    let resource = this.resources[path.toString()];

    if (!resource) {
      resource = new Resource();
      this.resources[path.toString()] = resource;
    }

    callback(null, resource.locks);
  }

  _propertyManager(path, ctx, callback) {
    console.log('_propertyManager', path)
    let resource = this.resources[path.toString()];
    
    if (!resource) {
      resource = new Resource();
      this.resources[path.toString()] = resource;
    }

    callback(null, resource.props);
  }

  _readDir(path, ctx, callback) {
    console.log('_readDir', path)
    const { realPath } = this.getRealPath(path);

    this.connect((c) => {
      c.list(realPath).then(list => {        
        callback(null, list.map((el) => el.name));
      }, () => {
        callback(webdav.Errors.ResourceNotFound)
      });
    });
  }

  _creationDate(path, ctx, callback) {
    console.log('_creationDate', path)
    if (path.isRoot()) {
      return callback(null, 0);
    }

    const { realPath } = this.getRealPath(path);

    this.connect((c) => {
      c.get(realPath).then(stats => {
        callback(null, stats.ctime);
      }, e => {
          callback(webdav.Errors.ResourceNotFound);
      });
    });
  }

  _lastModifiedDate(path, ctx, callback) {
    console.log('_lastModifiedDate', path)
    if (path.isRoot()) {
      return callback(null, 0);
    }

    const { realPath } = this.getRealPath(path);

    this.connect((c) => {
      c.get(realPath).then(stats => {
        callback(null, stats.mtime);
      }, e => {
          callback(webdav.Errors.ResourceNotFound);
      });
    });
  }

  _type(path, ctx, callback) {
    console.log('_type', path)
    if (path.isRoot()) {
      return callback(null, webdav.ResourceType.Directory);
    }

    const { realPath } = this.getRealPath(path.getParent());

    this.connect((c) => {
      c.list(realPath).then(list => {
        for (const element of list) {
          if (element.name === path.fileName()) {
            console.log('element', element)

            switch (element.type) {
              case 'file':
                return callback(webdav.Errors.ResourceNotFound); // TODO sharing?
              case 'bundle':
                return callback(null, webdav.ResourceType.File);
              case 'directory':
                return callback(null, webdav.ResourceType.Directory);
              default:
                return callback(webdav.Errors.ResourceNotFound);
            }
          }
        }

        callback(webdav.Errors.ResourceNotFound);
      }, e => {
        callback(webdav.Errors.ResourceNotFound);
      });
    });
  }
}

module.exports = {
  Resource,
  Serializer,
  FileSystem
};
