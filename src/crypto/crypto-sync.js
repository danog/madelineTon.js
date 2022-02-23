import factorize from "../crypto-sync/prime"
import {
    secureRandom,
    secureRandomInt
} from "../crypto-sync/random"
import {
    sha1,
    sha256,
    igeEncrypt,
    igeDecrypt,
    initEC,
    crc16
} from "../crypto-sync/crypto"
import {
    gunzipSync
} from "zlib"

class CryptoSync {
    /**
     * 
     * @param {Parser} parser TL Parser
     */
    constructor(parser) {
        this.TL = parser
    }
    /**
     * Factorize semiprime
     * @param {Uint8Array} what Number to factorize
     * @returns Uint8Array[]
     */
    factorize(what) {
        return Promise.resolve(factorize(what))
    }
    /**
     * Fill buffer with secure random values
     * @param {BufferSource} buffer Buffer to fill
     */
    secureRandom(buffer) {
        return Promise.resolve(secureRandom(buffer))
    }
    /**
     * Get secure random number modulo modulus
     * @param {number} mod Modulus
     */
    secureRandomInt(mod) {
        return Promise.resolve(secureRandomInt(mod))
    }
    /**
     * SHA1
     * @param {Uint32Array} data Data to hash
     * @returns Uint32Array
     */
    sha1(buffer) {
        return Promise.resolve(sha1(buffer))
    }
    /**
     * SHA256
     * @param {Uint32Array} data Data to hash
     * @returns Uint32Array
     */
    sha256(buffer) {
        return Promise.resolve(sha256(buffer))
    }
    /**
     * Encrypt data using AES IGE
     * @param {Uint32Array} data Data
     * @param {Uint32Array} key  Key
     * @param {Uint32Array} iv   IV
     */
    igeEncrypt(data, key, iv) {
        return Promise.resolve(igeEncrypt(data, key, iv))
    }
    /**
     * Decrypt data using AES IGE
     * @param {Uint32Array} data Data
     * @param {Uint32Array} key  Key
     * @param {Uint32Array} iv   IV
     */
    igeDecrypt(data, key, iv) {
        return Promise.resolve(igeDecrypt(data, key, iv))
    }

    /**
     * Deserialize TL payload
     * @param {Stream} data Data
     * @returns {Object}
     */
    deserialize(data) {
        return Promise.resolve(this.TL.deserialize(data))
    }

    /**
     * Generate elliptic-curve init context
     * @param {Uint32Array} peerPublic Peer's public Ed25519 key
     * @returns {Object}
     */
    initEC(peerPublic) {
        return Promise.resolve(initEC(peerPublic))
    }


    /**
     * Get crc16 checksum of data
     * @param {Uint8Array} data Data
     * @returns {Uint8Array} Checksum
     */
    crc16(data) {
        return Promise.resolve(crc16(data));
    }
}

export default CryptoSync