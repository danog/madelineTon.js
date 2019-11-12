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
    incCounter
} from "../crypto-sync/crypto"

/**
 * Implementation of AES CTR continuous buffering
 */
class Ctr {
    name = "AES-CTR"
    by = 0
    /**
     * 
     * @param {Uint32Array} iv 
     * @param {BufferSource} key 
     */
    constructor(iv, key) {
        this.counter = iv
        this.length = 16
        this.key = key
    }
    /**
     * Encrypt data
     * @param {BufferSource} data Data to encrypt
     */
    process(data) {
        incCounter(this.counter, this.by)
        this.by = (data.BYTES_PER_ELEMENT * data.length) / 16
        return window.crypto.subtle.encrypt(this, this.key, data)
    }
}

class CryptoSync {
    factorize(what) {
        return Promise.resolve(factorize(what))
    }
    secureRandom(buffer) {
        return Promise.resolve(secureRandom(buffer))
    }
    secureRandomInt(mod) {
        return Promise.resolve(secureRandomInt(mod))
    }
    /**
     * SHA1
     * @param {BufferSource} data Data to hash
     * @returns Uint8Array
     */
    sha1(buffer) {
        return Promise.resolve(sha1(buffer))
    }
    /**
     * SHA256
     * @param {BufferSource} data Data to hash
     * @returns Uint8Array
     */
    sha256(buffer) {
        return Promise.resolve(sha256(buffer))
    }
    igeEncrypt(data, key, iv) {
        return Promise.resolve(igeEncrypt(data, key, iv))
    }
    igeDecrypt(data, key, iv) {
        return Promise.resolve(igeDecrypt(data, key, iv))
    }
    /**
     * Get continuous CTR processor
     * @param {Uint32Array} iv 
     * @param {BufferSource} key 
     * @returns Ctr
     */
    getCtr(iv, key) {
        return new Ctr(iv, key)
    }
}
export default CryptoSync