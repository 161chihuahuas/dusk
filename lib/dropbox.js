'use strict';

const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { 
  uniqueNamesGenerator, 
  adjectives, 
  colors, 
  animals 
} = require('unique-names-generator');
const webdav = require('webdav-server').v2;
const { Readable } = require('node:stream');


class Dropbox {
  constructor(node, privMan, davServ) {
    this.node = node;
    this.privilegeManager = privMan;
    this.webdavServer = davServ;

    const _getFileSystemPathSync = this.webdavServer.getFileSystemPathSync
      .bind(this.webdavServer);

    this.webdavServer.getFileSystemPathSync = (fs) => {
      // Always set checkByReference to false
      return _getFileSystemPathSync(fs, false);
    }

    this.drpfs = this.webdavServer.getFileSystemSync(
      new webdav.Path('/Dropbox')
    ).fs;
    this.app = express();
    this.storage = multer.memoryStorage();
    this._upload = multer({ 
      storage: this.storage,
      limits: {
        fieldNameSize: 100,
        fieldSize: 1000 * 1000,
        fields: Infinity,
        fileSize: Infinity,
        files: Infinity,
        parts: Infinity,
        headerPairs: 2000
      },
      fileFilter: (req, res, next) => {
        next(null, true);
      },
      preservePath: false
    });

    this._init();
  }

  _init() {
    this.app.use(express.static(path.join(__dirname, '../assets')));
    this.app.get('/', (req, res) => this._servePage(req, res));
    this.app.post('/', this._upload.array('files', 12), 
      (req, res, next) => this._handleUpload(req, res, next));
    this.app.use((err, req, res, next) => {
      if (err) {
        return res.send(Dropbox.ERR_HTML(this._getvars({
          error: err.message
        })));
      }
      next();
    });
  }

  _getvars(add = {}) {
    return {
      duskTitle: '🝰 dusk',
      fingerprint: this.node.identity.toString('hex'),
      publicKey: this.node.contact.pubkey,
      error: add.error,
      codename: add.codename
    };
  }

  _servePage(req, res) {
    res.send(Dropbox.LANDING_HTML(this._getvars()));
  }

  async _handleUpload(req, res, next) {
    const { message } = req.body;
    const { files } = req;
    const randomName = uniqueNamesGenerator({ 
      dictionaries: [adjectives, colors, animals] 
    });

    const createFile = (path) => {
      return new Promise((resolve, reject) => {
        this.drpfs.create(this.webdavServer.createExternalContext({
          rootPath: '/',
          uri: '/Dropbox' + path
        }), '/Dropbox' + path, webdav.ResourceType.File, true, (e) => {
          if (e) {
            return reject(e);
          }
          resolve();          
        });
      });
    };

    const writeFile = (path, buffer) => {
      return new Promise((resolve, reject) => {
        this.drpfs.openWriteStream(this.webdavServer.createExternalContext({
          rootPath: '/',
          uri: '/Dropbox' + path
        }), '/Dropbox' + path, (err, wStream) => {
          if (err) {
            return reject(err);
          }
          Readable.from(buffer)
            .pipe(wStream).on('error', reject).on('close', resolve);
        });
      });
    };

    for (let f = 0; f < files.length; f++) {
      const writePath = `/${randomName}/${files[f].originalname}`;
      try {
        await createFile(writePath);
        await writeFile(writePath, files[f].buffer);
      } catch (err) {
        return res.send(Dropbox.ERR_HTML(this._getvars({ 
          error: err.message 
        })));
      }
    }

    if (message) {
      const writePath = `/${randomName}/Message.txt`;
      try {
        await createFile(writePath);
        await writeFile(writePath, message);
      } catch (err) {
        return res.send(Dropbox.ERR_HTML(this._getvars({ 
          error: err.message 
        })));
      }
    }

    res.send(Dropbox.SUCCESS_HTML(this._getvars({ 
      codename: randomName 
    })));
  }

  static get CSS() {
    return `
`;
  }

  static get JS() {
      return `'use strict';

document.addEventListener('DOMContentLoaded', function() {
  const notice = document.getElementById('notice');
  notice.innerHTML = 'JavaScript is enabled, so your files will be encrypted in the browser before sending.';
  const form = document.getElementById('upload');

  if (!form) {
    return;
  }

  form.addEventListener('submit', function(e) {
    //e.preventDefault();
    
    // do client side encryption
  }, false);
}, false);
`;
  }

  static TMPL_HTML(vars) {
    return `<!doctype html>
<html>
  <head>
    <title>${vars.duskTitle} ~ Send File(s)</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="css/normalize.css">
    <link rel="stylesheet" href="css/skeleton.css">
    <link rel="stylesheet" href="css/custom.css">
    <link rel="stylesheet" href="css/github-prettify-theme.css">
    <link rel="icon" type="image/png" href="images/favicon.png">
    <link rel="stylesheet" href="css/drop.css">
    <style type="text/css">
    ${Dropbox.CSS}
    </style>
    <script type="text/javascript">
    window.DUSK_PK = '${vars.publicKey}';
    ${Dropbox.JS}
    </script>
  </head>
  <body><section>
    <section id="notice">JavaScript is disabled, but your upload is still end-to-end encrypted by Tor.</section>
    <h1></h1>
    ${vars.content} 
    <footer><h3>${vars.duskTitle} is a deniable cloud drive. <sup><a href="https://rundusk.org"><em>[?]</em></a></sup></h3></footer>
  </section></body>
</html>`;
  }

  static LANDING_HTML(vars) {
    return Dropbox.TMPL_HTML({
      ...vars,
      content: `
<header>
  <img src="images/icon-files.png"/>
  <h1>Send File(s) to <code>${vars.fingerprint}</code><sup><a href="#"><em>[?]</em></a></sup></h1>
</header>
<form action="." method="post" enctype="multipart/form-data" id="upload">
  <label for="files"><input required="required" type="file" name="files" id="files"/></label>
  <label for="message"><textarea name="message" id="message" placeholder="Send a message with your file(s)..."></textarea></label>
  <label for="submit"><input id="submit" type="submit" value="🔐 Send"/></label>
</form>`
    });
  }

  static SUCCESS_HTML(vars) {
    return Dropbox.TMPL_HTML({
      ...vars,
      content: `
<header><h1>✅  File(s) sent to <code>${vars.fingerprint}</code><sup><a href="#"><em>[?]</em></a></sup></h1></header>
<section>
  <p>Your reference codename for this file drop is ${vars.codename}. <a href="/">Send more?</a></p>
</section>`
    });
  }

  static ERR_HTML(vars) {
    return Dropbox.TMPL_HTML({
        ...vars,
        content: `
<header><h1>⚠️  Failed sending file(s) to <code>${vars.fingerprint}</code><sup><a href="#"><em>[?]</em></a></sup></h1></header>
<section>Sorry, an error occurred. <a href="/">Try again?</a></section>`
    });
  }

  listen(port, cb) {
    this.app.listen.call(this.app, port, cb);
  }
}

module.exports = Dropbox;
