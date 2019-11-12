import Stream from "../TL/stream"
import Rusha from 'rusha'
import '../lib/cryptoJS/crypto'

/**
 * Increment AES CTR counter (big endian machines)
 * @param {Array}  counter Array of 32-bit integers
 * @param {number} by      Increment by
 */
const incCounterBigEndian = (counter, by) => {
    for (let x = 3; x >= 0; x--) {
        let tmp = counter[x] + by
        if (tmp > 0xFFFFFFFF) {
            counter[x] = tmp & 0xFFFFFFFF
            by = 1 // Assume increment is always < 0xFFFFFFFF
        } else {
            counter[x] = tmp
            return counter
        }
    }
    return counter
}
/**
 * Increment AES CTR counter (little endian machines)
 * @param {Uint32Array} counter Array of 32-bit integers
 * @param {number}      by      Increment by
 */
const incCounterLittleEndian = (counter, by) => {
    for (let x = 3; x >= 0; x--) {
        let tmp = Stream.switcheroo(counter[x]) + by
        if (tmp > 0xFFFFFFFF) {
            counter[x] = Stream.switcheroo(tmp & 0xFFFFFFFF)
            by = 1 // Assume increment is always < 0xFFFFFFFF
        } else {
            counter[x] = Stream.switcheroo(tmp)
            return counter
        }
    }
    return counter
}
const incCounter = Stream.bigEndian ? incCounterBigEndian : incCounterLittleEndian

/**
 * Convert Uint32Array to CryptoJS big-endian int32 buffer
 * @param {Uint32Array} buffer Buffer
 * @returns CryptoJS.lib.WordArray
 */
const bytesToWordsBigEndian = buffer => new CryptoJS.lib.WordArray.init(buffer)
const bytesToWordsLittleEndian = buffer => new CryptoJS.lib.WordArray.init(buffer.map(Stream.switcheroo))
const bytesToWords = Stream.bigEndian ? bytesToWordsBigEndian : bytesToWordsLittleEndian

/**
 * Convert CryptoJS big-endian int32 buffer to Uint32Array
 * @param {CryptoJS.lib.WordArray} buffer Buffer
 * @returns Uint32Array
 */
const wordsToBytesBigEndian = buffer => Uint32Array.from(buffer.words)
const wordsToBytesLittleEndian = buffer => Uint32Array.from(buffer.words, Stream.switcheroo)
const wordsToBytes = Stream.bigEndian ? wordsToBytesBigEndian : wordsToBytesLittleEndian

/**
 * SHA256 hash
 * @param {Uint8Array} data Data to hash
 */
const sha256 = data => {
    return bytesFromWords(CryptoJS.SHA256(bytesToWords(data)))
}
const rushaInstance = new Rusha(1024 * 1024)
/**
 * SHA1 hash
 * @param {Uint8Array} data Data to hash
 * @returns int32Array
 */
const sha1 = rushaInstance.rawDigest.bind(rushaInstance)

/**
 * Encrypt using AES IGE
 * @param {BufferSource} data 
 * @param {BufferSource} key 
 * @param {BufferSource} iv 
 */
const igeEncrypt = (data, key, iv) => {
    return wordsToBytes(
        CryptoJS.AES.encrypt(
            bytesToWords(data),
            bytesToWords(key), {
                iv: bytesToWords(iv),
                padding: CryptoJS.pad.NoPadding,
                mode: CryptoJS.mode.IGE
            }
        ).ciphertext
    )
}
/**
 * Decrypt using AES IGE
 * @param {BufferSource} data 
 * @param {BufferSource} key 
 * @param {BufferSource} iv 
 */
const igeDecrypt = (data, key, iv) => {
    return wordsToBytes(
        CryptoJS.AES.decrypt(
            bytesToWords(data),
            bytesToWords(key), {
                iv: bytesToWords(iv),
                padding: CryptoJS.pad.NoPadding,
                mode: CryptoJS.mode.IGE
            }
        ).ciphertext
    )
}

/**
 * Encrypt/decrypt using AES CTR
 * @param {BufferSource} data 
 * @param {BufferSource} key 
 * @param {BufferSource} iv 
 */
const ctr = (data, key, iv) => {
    return bytesFromWords(
        CryptoJS.AES.encrypt(
            bytesToWords(data),
            bytesToWords(key), {
                iv: bytesToWords(iv),
                padding: CryptoJS.pad.NoPadding,
                mode: CryptoJS.mode.CTR
            }
        ).ciphertext
    )
}
export {
    incCounter,
    incCounterBigEndian,
    sha256,
    sha1,
    igeEncrypt,
    igeDecrypt,
    ctr
}