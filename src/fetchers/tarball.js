/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import { SecurityError, MessageError } from "../errors.js";
import * as crypto from "../util/crypto.js";
import BaseFetcher from "./_base.js";
import * as fsUtil from "../util/fs.js";

let zlib = require("zlib");
let tar  = require("tar");
let url  = require("url");
let through = require("through2");
let fs = require("fs");
let path = require("path");

export default class TarballFetcher extends BaseFetcher {

  async _fetch(dest: string): Promise<string> {
    let { reference: ref, hash, config, saveForOffline, registry } = this;

    let parts = url.parse(ref);
    if (!hash) {
      if (parts.protocol === "http:") {
        throw new SecurityError(`${ref}: Refusing to fetch tarball over plain HTTP without a hash`);
      }
    }
    if (parts.protocol === null) {
      let localTarball = path.resolve(this.config.getOfflineMirrorPath(registry, null), ref);

      if (!(await fsUtil.exists(localTarball))) {
        throw new MessageError(`${ref}: Tarball is not in network and can't be located in cache`);
      }

      return new Promise((resolve, reject) => {
        let validateStream = crypto.hashStreamValidation();

        let extractor = tar.Extract({ path: dest, strip: 1 })
          .on("error", reject)
          .on("end", function () {
            let expectHash = hash;
            let actualHash = validateStream.getHash();
            if (!expectHash || expectHash === actualHash) {
              resolve(actualHash);
            } else {
              reject(new SecurityError(
                `Bad hash. Expected ${expectHash} but got ${actualHash}`
              ));
            }
          });
        // flow gets confused with the pipe/on types chain
        let cachedStream: Object = fs.createReadStream(localTarball);
        cachedStream
          .pipe(validateStream)
          .pipe(zlib.createUnzip())
          .on("error", reject)
          .pipe(extractor);
      });
    }

    return this.config.requestManager.request({
      url: ref,
      headers: {
        "Accept-Encoding": "gzip"
      },
      process(req, resolve, reject) {
        let validateStream = crypto.hashStreamValidation();

        //
        let extractor = tar.Extract({ path: dest, strip: 1 })
          .on("error", reject)
          .on("end", function () {
            let expectHash = hash;
            let actualHash = validateStream.getHash();
            if (!expectHash || expectHash === actualHash) {
              resolve(actualHash);
            } else {
              reject(new SecurityError(
                `Bad hash. Expected ${expectHash} but got ${actualHash}`
              ));
            }
          });

        //
        let mirrorPath = config.getOfflineMirrorPath(registry, ref);
        let mirrorTarballStream;
        if (mirrorPath && saveForOffline) {
          mirrorTarballStream = fs.createWriteStream(mirrorPath);
          mirrorTarballStream.on("error", reject);
        }
        let mirrorSaver = through(function (chunk, enc, callback) {
          if (mirrorTarballStream) {
            mirrorTarballStream.write(chunk, enc);
          }
          callback(null, chunk);
        });

        //
        req
          .on("redirect", function () {
            if (hash) return;

            let href = this.uri.href;
            let parts = url.parse(href);
            if (parts.protocol === "http:") {
              throw new SecurityError(
                `While downloading the tarball ${ref} we encountered a HTTP redirect of ${href}. ` +
                "This is not allowed unless a tarball hash is specified."
              );
            }
          })
          .pipe(validateStream)
          .pipe(mirrorSaver)
          .pipe(zlib.createUnzip())
          .on("error", reject)
          .pipe(extractor);
      }
    });
  }
}
