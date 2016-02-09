/* @flow */
/* eslint no-unused-vars: 0 */

import type { PackageInfo, PackageRemote } from "../types.js";
import type { RegistryNames } from "../registries/index.js";
import type Config from "../config.js";
import normalisePackageInfo from "../util/normalise-package-info/index.js";
import * as constants from "../constants.js";
import * as util from "../util/misc.js";
import * as fs from "../util/fs.js";

let path = require("path");

export default class BaseFetcher {
  constructor(remote: PackageRemote, config: Config) {
    this.reference = remote.reference;
    this.registry  = remote.registry;
    this.hash      = remote.hash;
    this.config    = config;
  }

  registry: RegistryNames;
  reference: any;
  config: Config;
  hash: ?string;

  async _fetch(dest: string): Promise<string> {
    throw new Error("Not implemented");
  }

  fetch(dest: string): Promise<{
    hash: string,
    package: PackageInfo
  }> {
    return fs.lockQueue.push(dest, async () => {
      // fetch package and get the hash
      let hash = await this._fetch(dest);

      // load the new normalised package.json
      let pkg = await fs.readPackageJson(dest, this.registry);
      pkg = await normalisePackageInfo(pkg, dest);

      await fs.writeFile(path.join(dest, constants.METADATA_FILENAME), JSON.stringify({
        registry: this.registry,
        hash
      }, null, "  "));

      return {
        hash,
        package: pkg
      };
    });
  }
}
