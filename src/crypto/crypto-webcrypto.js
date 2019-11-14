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
import {
    posMod
} from "../tools"

/**
 * Implementation of native AES CTR continuous buffering
 */
class CtrProcessor {
    /**
     * Init processor
     * @param {Uint32Array} iv 
     * @param {Uint32Array} key 
     */
    init(key, iv) {
        this.name = "AES-CTR"
        this.by = 0
        this.counter = iv
        this.length = 16
        this.leftover = new Uint8Array(0)
        return windowObject.crypto.subtle.importKey("raw", key.buffer, "AES-CTR", false, ["encrypt"])
            .then(key => {
                this.key = key;
                return this
            })
    }
    /**
     * Encrypt data
     * @param {ArrayBufferView} data Data to encrypt
     * @returns {ArrayBuffer}
     */
    process(data) {
        // Turn block cipher into stream cypher by padding + reusing the last partial block
        let lengthOrig = data.byteLength
        let lengthCombined = lengthOrig
        let offset = 0
        if (offset = this.leftover.byteLength) {
            lengthCombined += offset
            let newData = new Uint8Array(lengthCombined + posMod(-lengthCombined, 16))
            newData.set(this.leftover)
            newData.set(new Uint8Array(data.buffer), offset)
            data = newData.buffer
        } else {
            data = pad(data, 16)
        }

        incCounter(this.counter, this.by)
        this.by = Math.floor(lengthCombined / 16)
        this.leftover = new Uint8Array(data.slice(this.by * 16, lengthCombined))

        return windowObject.crypto.subtle.encrypt(this, this.key, data).then(res => res.slice(offset, offset + lengthOrig))
    }
    close() {}
}

/**
 * 
 * @param {Uint32Array} key 
 * @param {Uint32Array} data 
 * @param {number} offset 
 * @param {Uint32Array} iv1 
 * @param {Uint32Array} iv2 
 * @returns {ArrayBuffer}
 */
const processIgeEncrypt = (key, data, offset, iv1, iv2) => {
    // I could've also used CBC, but webcrypto's CBC implementation pads the output by default.
    // This would be fine in itself if it weren't for the fact that webcrypto is forced to do one extra (& useless) AES round per block
    // CTR doesn't pad the output, so it's perfect.
    
    const next = offset + 4
    const block = data.slice(offset, next)
    return windowObject.crypto.subtle.encrypt({
            name: 'AES-CTR',
            counter: block.map((v, i) => v ^ iv1[i]),
            length: 16
        }, key, iv2)
        .then(newBlock => {
            newBlock = new Uint32Array(newBlock)
            data.set(newBlock, offset)

            if (next < data.length) {
                return processIgeEncrypt(key, data, next, newBlock, block)
            }
            return data.buffer
        })
}
/**
 * Webcrypto implementation
 */
class CryptoWebCrypto {
    /**
     * SHA1
     * @param {BufferSource} data Data to hash
     * @returns {ArrayBuffer}
     */
    sha1(data) {
        return windowObject.crypto.subtle.digest('SHA-1', data)
    }
    /**
     * SHA256
     * @param {BufferSource} data Data to hash
     * @returns {ArrayBuffer}
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
        return new CtrProcessor().init(key, iv)
    }
    /**
     * Encrypt data using AES IGE
     * @param {Uint32Array} data Data
     * @param {Uint32Array} key  Key
     * @param {Uint32Array} iv   IV
     * @returns {ArrayBuffer}
     */
    igeEncrypt(data, key, iv) {
        // Implement AES IGE using AES CTR and some additional XOR-ing
        // Use native WebCrypto for greater AES performance
        // Unfortunately, I can't implement native AES IGE decryption because webcrypto assumes PKCS padding for the cyphertext
        return windowObject.crypto.subtle.importKey("raw", key.buffer, "AES-CTR", false, ["encrypt"])
            .then(key => processIgeEncrypt(key, data, 0, iv.subarray(0, 4), iv.subarray(4, 8)))
    }

}

export default CryptoWebCrypto