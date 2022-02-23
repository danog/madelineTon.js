import Stream from "../TL/stream"
import Rusha from 'rusha'
import CryptoJS from '../lib/cryptoJS/crypto'
import {
    transfer,
    bytesToHex,
    hexToBytes
} from "../tools"
import {
    dup,
    addInt,
    sub,
    inverseMod,
    multMod,
    str2bigInt,
    mod,
    bigInt2str
} from "leemon"
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
    peerPublic = new Uint8Array(peerPublic.slice().buffer)
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

    const edwardsPair = nacl.sign.keyPair() // nacl.sign.keyPair.fromSeed(hexToBytes('de880e4b5ee99eb1e6b31b8466a63ba4add52c4c91ac34bc23b9c33cb9f4e646'))
    const montgomeryPair = nacl.box.keyPair.fromSecretKey(edwardsPair.d.slice(0, 32))

    const secret = nacl.scalarMult(montgomeryPair.secretKey, peerPublic)

    //console.log("Private: ", bytesToHex(montgomeryPair.secretKey))
    //console.log("Public: ", bytesToHex(peerPublic))
    //console.log("Secret: ", bytesToHex(secret))

    const pub = edwardsPair.publicKey
    //console.log("Public sent: ", bytesToHex(pub))

    return {
        pub,
        secret
    }
}

const crc16Table = [
    0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7, 0x8108, 0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad,
    0xe1ce, 0xf1ef, 0x1231, 0x0210, 0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6, 0x9339, 0x8318, 0xb37b, 0xa35a,
    0xd3bd, 0xc39c, 0xf3ff, 0xe3de, 0x2462, 0x3443, 0x0420, 0x1401, 0x64e6, 0x74c7, 0x44a4, 0x5485, 0xa56a, 0xb54b,
    0x8528, 0x9509, 0xe5ee, 0xf5cf, 0xc5ac, 0xd58d, 0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6, 0x5695, 0x46b4,
    0xb75b, 0xa77a, 0x9719, 0x8738, 0xf7df, 0xe7fe, 0xd79d, 0xc7bc, 0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861,
    0x2802, 0x3823, 0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b, 0x5af5, 0x4ad4, 0x7ab7, 0x6a96,
    0x1a71, 0x0a50, 0x3a33, 0x2a12, 0xdbfd, 0xcbdc, 0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a, 0x6ca6, 0x7c87,
    0x4ce4, 0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41, 0xedae, 0xfd8f, 0xcdec, 0xddcd, 0xad2a, 0xbd0b, 0x8d68, 0x9d49,
    0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13, 0x2e32, 0x1e51, 0x0e70, 0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a,
    0x9f59, 0x8f78, 0x9188, 0x81a9, 0xb1ca, 0xa1eb, 0xd10c, 0xc12d, 0xf14e, 0xe16f, 0x1080, 0x00a1, 0x30c2, 0x20e3,
    0x5004, 0x4025, 0x7046, 0x6067, 0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e, 0x02b1, 0x1290,
    0x22f3, 0x32d2, 0x4235, 0x5214, 0x6277, 0x7256, 0xb5ea, 0xa5cb, 0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d,
    0x34e2, 0x24c3, 0x14a0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405, 0xa7db, 0xb7fa, 0x8799, 0x97b8, 0xe75f, 0xf77e,
    0xc71d, 0xd73c, 0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657, 0x7676, 0x4615, 0x5634, 0xd94c, 0xc96d, 0xf90e, 0xe92f,
    0x99c8, 0x89e9, 0xb98a, 0xa9ab, 0x5844, 0x4865, 0x7806, 0x6827, 0x18c0, 0x08e1, 0x3882, 0x28a3, 0xcb7d, 0xdb5c,
    0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a, 0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92,
    0xfd2e, 0xed0f, 0xdd6c, 0xcd4d, 0xbdaa, 0xad8b, 0x9de8, 0x8dc9, 0x7c26, 0x6c07, 0x5c64, 0x4c45, 0x3ca2, 0x2c83,
    0x1ce0, 0x0cc1, 0xef1f, 0xff3e, 0xcf5d, 0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8, 0x6e17, 0x7e36, 0x4e55, 0x5e74,
    0x2e93, 0x3eb2, 0x0ed1, 0x1ef0
]

/**
 * Get crc16 checksum of data
 * @param {Uint8Array} data Data
 * @returns {Uint8Array} Checksum
 */
const crc16 = data => {
    let crc = 0
    const length = data.byteLength
    for (let x = 0; x < length; x++) {
        crc = crc16Table[(data[x] ^ (crc >> 8)) & 0xFF] ^ (crc << 8)
    }
    crc &= 0xFFFF
    return new Uint8Array([
        crc >> 8,
        crc & 0xFF
    ])
}
export {
    incCounter,
    incCounterBigEndian,
    sha256,
    sha1,
    igeEncrypt,
    igeDecrypt,
    pad,
    initEC,
    crc16
}