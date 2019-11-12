import Stream from "../TL/stream"
import Rusha from 'rusha'
import CryptoJS from '../lib/cryptoJS/crypto'
import { posMod } from "madelineNode/src/tools"

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
 * Pad buffer
 * @param {ArrayBuffer} buffer Buffer
 * @param {number}      size   Pad to a multiple of this
 * @returns ArrayBuffer
 */
const pad = (buffer, size) => buffer.byteLength % size ? ArrayBuffer.transfer(buffer, buffer.byteLength + posMod(-buffer.byteLength, size)) : buffer
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
const sha256 = data => bytesFromWords(CryptoJS.SHA256(bytesToWords(data)))

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
 * @param {Uint32Array} key 
 * @param {Uint32Array} iv 
 * @returns {Uint32Array}
 */
const igeEncrypt = (data, key, iv) => wordsToBytes(
    CryptoJS.AES.encrypt(
        bytesToWords(data),
        bytesToWords(key), {
            iv: bytesToWords(iv),
            padding: CryptoJS.pad.NoPadding,
            mode: CryptoJS.mode.IGE
        }
    ).ciphertext
)

/**
 * Decrypt using AES IGE
 * @param {BufferSource} data 
 * @param {Uint32Array} key 
 * @param {Uint32Array} iv 
 * @returns {Uint32Array}
 */
const igeDecrypt = (data, key, iv) => wordsToBytes(
    CryptoJS.AES.decrypt({
            ciphertext: bytesToWords(data)
        },
        bytesToWords(key), {
            iv: bytesToWords(iv),
            padding: CryptoJS.pad.NoPadding,
            mode: CryptoJS.mode.IGE
        }
    )
)

/**
 * Implementation of CryptoJS AES CTR continuous buffering
 */
class CtrProcessor {
    /**
     * 
     * @param {Uint32Array} iv 
     * @param {Uint32Array} key 
     */
    constructor(iv, key) {
        this.processor = CryptoJS.mode.CTR.createEncryptor(bytesToWords(key), {
            iv: bytesToWords(iv),
            padding: CryptoJS.pad.NoPadding,
        })
    }
    /**
     * Encrypt data
     * @param {BufferSource} data Data to encrypt
     */
    process(data) {
        data = bytesToWords(pad(data, 16))
        const len = data.length
        for (let x = 0; x < len; x += 4) {
            this.processor.processBlock(data, x)
        }
        return data
    }
}

export {
    incCounter,
    incCounterBigEndian,
    sha256,
    sha1,
    igeEncrypt,
    igeDecrypt,
    ctr,
    CtrProcessor,
    pad
}