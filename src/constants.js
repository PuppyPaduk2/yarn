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

// max amount of network requests to perform concurrently
export const NETWORK_CONCURRENCY = 15;

// max amount of child processes to execute concurrently
export const CHILD_CONCURRENCY = 5;

export const REQUIRED_PACKAGE_KEYS = ["name", "version", "uid"];

export const LOCKFILE_FILENAME = "kpm.lock";
export const METADATA_FILENAME   = ".kpm-metadata.json";

export const USER_AGENT = "kpm";

export let ENV_PATH_KEY = "PATH";

// windows calls it's path "Path" usually, but this is not guaranteed.
if (process.platform === "win32") {
  ENV_PATH_KEY = "Path";

  for (let key in process.env) {
    if (key.match(/^PATH$/i)) {
      ENV_PATH_KEY = key;
    }
  }
}
