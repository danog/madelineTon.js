/**
 * Webcrypto implementaition
 *
 * Copyright 2016-2019 Daniil Gentili
 * (https://daniil.it)
 * This file is part of MadelineNode.
 * MadelineNode is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * MadelineNode is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 * You should have received a copy of the GNU General Public License along with MadelineNode.
 * If not, see <http://www.gnu.org/licenses/>.
 *
 * @author    Daniil Gentili <daniil@daniil.it>
 * @copyright 2016-2019 Daniil Gentili <daniil@daniil.it>
 * @license   https://opensource.org/licenses/AGPL-3.0 AGPLv3
 */

import {
    incCounter,
    pad
} from "../crypto-sync/crypto"
import {
    windowObject
} from "../crypto-sync/poly"

/**
 * Implementation of native AES CTR continuous buffering
 */
class CtrProcessor {
    /**
     * Init processor
     * @param {Uint32Array} iv 
     * @param {Uint32Array} key 
     */
    constructor(key, iv) {
        this.name = "AES-CTR"
        this.by = 0
        this.counter = iv
        this.length = 16
        this.keyPromise = windowObject.crypto.subtle.importKey("raw", key.buffer, "AES-CTR", false, ["encrypt"])
        this.keyPromise.then(key => this.key = key)
    }
    getInitPromise() {
        return this.keyPromise.then(() => this)
    }
    /**
     * Encrypt data
     * @param {BufferSource} data Data to encrypt
     * @returns {Uint32Array}
     */
    process(data) {
        data = pad(data, 16)
        incCounter(this.counter, this.by)
        this.by = data.length / 16
        return windowObject.crypto.subtle.encrypt(this, this.key, data)
    }
    close() {}
}
/**
 * Webcrypto implementation
 */
class CryptoWebCrypto {
    /**
     * SHA1
     * @param {BufferSource} data Data to hash
     * @returns Uint8Array
     */
    sha1(data) {
        return windowObject.crypto.subtle.digest('SHA-1', data)
    }
    /**
     * SHA256
     * @param {BufferSource} data Data to hash
     * @returns Uint8Array
     */
    sha256(data) {
        return windowObject.crypto.subtle.digest('SHA-256', data)
    }
    /**
     * Get continuous CTR processor
     * @param {Uint32Array} iv 
     * @param {Uint32Array} key 
     * @returns CtrProcessor
     */
    getCtr(key, iv) {
        return new CtrProcessor(key, iv).getInitPromise()
    }
}

export default CryptoWebCrypto