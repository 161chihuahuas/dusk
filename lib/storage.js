'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');


class Storage {

  constructor(dirpath) {
    this.root = dirpath;

    if (!fs.existsSync(this.root)) {
      fs.mkdirSync(this.root, { recursive: true });
    } else {
      if (fs.statSync(this.root).isFile()) {
        throw new Error('Invalid storage path');
      }
    }
  }

  get(key, _opts, callback) {
    const info = key + '.info';

    fs.readFile(path.join(this.root, info), (err, data) => {
      if (err) {
        return this.emit('error', err);
      }

      const item = JSON.parse(data);
      const key = info.split('.')[0];
      const datafile = path.join(this.root, key + '.part');

      fs.readFile(datafile, (err, buffer) => {
        if (err) {
          return this.emit('error', err);
        }

        item.value = buffer.toString('hex');

        callback(null, item);
      });
    });
  }

  put(key, item, _opts, callback) {
    let { value, timestamp, publisher } = item;
    const blob = Buffer.from(value, 'hex');
    const info = JSON.stringify({ timestamp, publisher });
    const blobInfoPath = path.join(this.root, key + '.info');
    const blobDataPath = path.join(this.root, key + '.part');

    fs.writeFile(blobDataPath, blob, (err) => {
      if (err) {
        return callback(err);
      }

      fs.writeFile(blobInfoPath, info, (err) => {
        if (err) {
          return callback(err);
        }

        callback();
      });
    });
  }

  del(key, callback) {
    if (!this._exists(key)) {
      return callback(new Error(key + ' not found'));
    }

    fs.unlink(
      path.join(this.root, key + '.info'),
      (err) => {
        if (err) {
          return callback(err);
        }
        fs.unlink(
          path.join(this.root, key + '.part'),
          callback
        );
      }
    );
  }

  createReadStream() {
    const list = fs.readdirSync(this.root).filter((filename) => {
      return path.extname(filename) === '.info';
    }).sort();
    const rStream = new Readable({
      objectMode: true,
      read: () => {
        const info = list.shift();

        if (!info) {
          return rStream.push(null);
        }

        this.get(info.split('.')[0], {}, (err, item) => {
          if (err) {
            return this.emit('error', err);
          }

          rStream.push(item);
        });
      }
    });

    return rStream;
  }

  _exists(key) {
    return fs.existsSync(path.join(this.root, key + '.info')) && 
      fs.existsSync(path.join(this.root, key + '.part'));
  }

}

module.exports = Storage;
