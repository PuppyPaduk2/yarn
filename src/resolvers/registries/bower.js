/* @flow */

import type { PackageInfo } from "../../types.js";
import { MessageError } from "../../errors.js";
import RegistryResolver from "./_base.js";
import GitResolver from "../exotics/git.js";

export default class BowerResolver extends RegistryResolver {
  static registry = "bower";

  async resolve(): Promise<PackageInfo> {
    let body = await this.config.requestManager.request({
      url: `${this.registryConfig.registry}/packages/${this.name}`,
      json: true
    });

    if (body) {
      return this.fork(GitResolver, false, `${body.url}#${this.range}`);
    } else {
      throw new MessageError(`Couldn't find package ${this.name} on the bower registry`);
    }
  }
}
