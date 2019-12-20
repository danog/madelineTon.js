import Stream from "../TL/stream"
import Rusha from 'rusha'
import CryptoJS from '../lib/cryptoJS/crypto'
import {
    transfer, bytesToHex, hexToBytes
} from "../tools"
import { dup, addInt, sub, inverseMod, multMod, str2bigInt, mod, bigInt2str } from "leemon"
import nacl from '../lib/nacl-fast'

const modulo = str2bigInt('7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed', 16)

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
const sha256 = data => wordsToBytes(CryptoJS.SHA256(bytesToWords(data instanceof Uint32Array ? data : new Uint32Array(data.buffer)))).words.buffer

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
 * Generate elliptic-curve init context
 * @param {{Uint32Array}} peerPublic Peer's public Ed25519 key
 * @returns {Object}
 */
const initEC = peerPublic => {
    peerPublic = new Uint8Array(peerPublic.buffer)
    peerPublic[31] &= 127
    peerPublic = peerPublic.reverse()

    let y = str2bigInt(bytesToHex(peerPublic), 16)
    let y2 = dup(y)

    y = addInt(y, 1)
    y2 = addInt(y2, -1)
    y2 = sub(modulo, y2)
    y2 = mod(y2, modulo)
    y2 = inverseMod(y2, modulo)

    peerPublic = multMod(y, y2, modulo)
    peerPublic = hexToBytes(bigInt2str(peerPublic, 16)).reverse()

    const edwardsPair = nacl.sign.keyPair.fromSeed(hexToBytes('de880e4b5ee99eb1e6b31b8466a63ba4add52c4c91ac34bc23b9c33cb9f4e646'))
    const montgomeryPair = nacl.box.keyPair.fromSecretKey(edwardsPair.d.slice(0, 32))

    const secret = nacl.scalarMult(montgomeryPair.secretKey, peerPublic)

    console.log("Private: ", bytesToHex(montgomeryPair.secretKey))
    console.log("Public: ", bytesToHex(peerPublic))
    console.log("Secret: ", bytesToHex(secret))

    const pub = edwardsPair.publicKey
    console.log("Public sent: ", bytesToHex(pub))

    return {
        pub,
        secret
    }
}
export {
    incCounter,
    incCounterBigEndian,
    sha256,
    sha1,
    igeEncrypt,
    igeDecrypt,
    pad,
    initEC
}