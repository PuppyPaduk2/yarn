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

import { SecurityError } from "../errors.js";
import * as crypto from "../util/crypto.js";
import BaseFetcher from "./_base.js";

let zlib = require("zlib");
let tar  = require("tar");
let url  = require("url");

export default class TarballFetcher extends BaseFetcher {
  async _fetch(dest: string): Promise<string> {
    let { reference: ref, hash } = this;

    if (!hash) {
      let parts = url.parse(ref);
      if (parts.protocol === "http:") {
        throw new SecurityError(`Refusing to fetch tarball ${ref} over plain HTTP without a hash`);
      }
    }

    return this.config.requestManager.request({
      url: ref,
      headers: {
        "Accept-Encoding": "gzip"
      },
      process(req, resolve, reject) {
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
                `Bad hash for tarball ${ref}. Expected ${expectHash} but ${actualHash}.`
              ));
            }
          });

        req
          .on("redirect", function () {
            if (hash) return;

            let href = this.uri.href;
            let parts = url.parse(href);
            if (parts.protocol === "http:") {
              throw new SecurityError(
                `While downloading the tarball ${ref} we encountered a HTTP redirect of ${href}. ` +
                `This is not allowed unless a tarball hash is specified.`
              );
            }
          })
          .pipe(validateStream)
          .pipe(zlib.createUnzip())
          .on("error", reject)
          .pipe(extractor);
      }
    });
  }
}
