import { rng_seed_time, rng_get_bytes } from '../lib/rng'
import { useWebCryptoRandom, useWorkers, windowObject } from './poly'

/**
 * Fill array with non-cryptographically secure random values
 * @param {BufferSource} buffer Buffer to fill
 */
const fastRandom = buffer => {
    let myBuf = buffer;
    if (!(buffer instanceof Uint8Array)) {
        myBuf = new Uint8Array(buffer.buffer)
    }
    const length = myBuf.byteLength
    for (let x = 0; x < length; x++) {
        myBuf[x] = Math.floor(Math.random() * 0xFF)
    }
    return buffer
}

/**
 * Fill array with cryptographically secure random values
 * @param {BufferSource} buffer Buffer to fill
 */
let secureRandom;
if (useWebCryptoRandom) {
    secureRandom = windowObject.crypto.getRandomValues.bind(windowObject.crypto)
} else {
    if (typeof window !== 'undefined' && !useWorkers) {
        window.onclick = rng_seed_time
        window.onkeydown = rng_seed_time
    }

    secureRandom = buffer => {
        let myBuf = buffer;
        if (!(buffer instanceof Uint8Array)) {
            myBuf = new Uint8Array(buffer.buffer)
        }
        rng_get_bytes(myBuf)
        return buffer
    }
}

/**
 * Get non-cryptographically secure integer modulo mod
 * @param {number} mod Modulo
 * @returns number
 */
const fastRandomInt = mod => {
    return Math.floor(Math.random() * (mod || 0xFFFFFFFF))
}

/**
 * Get cryptographically secure integer modulo mod
 * @param {number} mod Modulo
 * @returns number
 */
const secureRandomInt = mod => {
    return secureRandom(new Uint32Array(1))[0] % (mod || 0xFFFFFFFF)
}

export {
    fastRandom,
    fastRandomInt,
    secureRandom,
    secureRandomInt
}