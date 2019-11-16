import Stream from "../TL/stream"
import Rusha from 'rusha'
import CryptoJS from '../lib/cryptoJS/crypto'
import {
    posMod, transfer
} from "../tools"

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
 * @param {BufferSource} buffer Buffer
 * @param {number}       size   Pad to a multiple of this (must be a multiple of 4)
 * @returns {ArrayBuffer} Padded array
 */
const pad = (buffer, pad) => {
    if (!(buffer instanceof ArrayBuffer)) {
        buffer = buffer.buffer
    }
    const mod = buffer.byteLength % pad
    if (mod) {
        return transfer(buffer, buffer.byteLength + (pad - mod))
    }
    return buffer
}
/**
 * Convert Uint32Array to CryptoJS big-endian int32 buffer
 * @param {Uint32Array} buffer Buffer
 * @returns {CryptoJS.lib.WordArray}
 */
const bytesToWordsLittleEndian = buffer => new CryptoJS.lib.WordArray.init(buffer.map(Stream.switcheroo))
const bytesToWordsBigEndian = buffer => new CryptoJS.lib.WordArray.init(buffer)
const bytesToWords = Stream.bigEndian ? bytesToWordsBigEndian : bytesToWordsLittleEndian

/**
 * Convert CryptoJS big-endian int32 buffer to Uint32Array
 * @param {CryptoJS.lib.WordArray} buffer Buffer
 * @returns {ArrayBuffer}
 */
const wordsToBytesLittleEndian = buffer => Uint32Array.from(buffer.words.map(Stream.switcheroo)).buffer
const wordsToBytesBigEndian = buffer => Uint32Array.from(buffer.words).buffer
const wordsToBytes = Stream.bigEndian ? wordsToBytesBigEndian : wordsToBytesLittleEndian

const toBigEndian = Stream.bigEndian ? (buffer => buffer) : buffer => buffer.map(Stream.switcheroo)
/**
 * SHA256 hash
 * @param {Uint32Array} data Data to hash
 */
const sha256 = data => wordsToBytes(CryptoJS.SHA256(bytesToWords(data)))

const rushaInstance = new Rusha(1024 * 1024)
/**
 * SHA1 hash
 * @param {Uint32Array} data Data to hash
 * @returns {ArrayBuffer}
 */
const sha1 = data => rushaInstance.rawDigest(data).buffer

/**
 * Encrypt using AES IGE
 * @param {Uint32Array} data 
 * @param {Uint32Array} key 
 * @param {Uint32Array} iv 
 * @returns {ArrayBuffer}
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
 * @param {Uint32Array} data 
 * @param {Uint32Array} key 
 * @param {Uint32Array} iv 
 * @returns {ArrayBuffer}
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
     * Init processor
     * @param {Uint32Array} key 
     * @param {Uint32Array} iv 
     */
    constructor(key, iv) {
        this.counter = iv
        this.leftover = new Uint8Array(0)
        this.processor = CryptoJS.algo.AES.createEncryptor(key)
    }
    encryptCounter(increment) {
        this.aesCounter = this.counter.slice()
        this.processor.encryptBlock(this.aesCounter, 0)
        incCounter(this.counter, increment)
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

        const length = Math.floor(lengthCombined / 16) * 4
        this.leftover = new Uint8Array(data.slice(length * 4, lengthCombined))

        data = toBigEndian(new Uint32Array(data))
        for (let x = 0; x < length; x++) {
            let mod = length % 4
            if (!mod) {
                this.encryptCounter(1)
            }
            data[x] = data[x] ^ this.aesCounter[mod]
        }
        if (this.leftover.byteLength) {
            this.encryptCounter(0)
            for (let x = length; x < length + 4; x++) {
                data[x] = data[x] ^ this.aesCounter[length % 4]
            }
        }

        return data.buffer.slice(offset, offset + lengthOrig)
    }
    close() {}
}

export {
    incCounter,
    incCounterBigEndian,
    sha256,
    sha1,
    igeEncrypt,
    igeDecrypt,
    CtrProcessor,
    pad
}