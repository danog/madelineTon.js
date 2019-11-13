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
    CtrProcessor
} from "../crypto-sync/crypto"

const SyncPromiseProcessor = CtrProcessor
SyncPromiseProcessor.prototype.processInternal = SyncPromiseProcessor.prototype.process
SyncPromiseProcessor.prototype.process = data => Promise.resolve(this.processInternal(data))

class CryptoSync {
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
     * Get continuous CTR processor
     * @param {Uint32Array} iv 
     * @param {Uint32Array} key 
     * @returns CtrProcessor
     */
    getCtr(key, iv) {
        return Promise.resolve(new SyncPromiseProcessor(key, iv))
    }
}
export default CryptoSync