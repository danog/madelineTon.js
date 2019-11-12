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
     * @returns CtrProcessor
     */
    getCtr(iv, key) {
        return new SyncPromiseProcessor(iv, key)
    }
}
export default CryptoSync