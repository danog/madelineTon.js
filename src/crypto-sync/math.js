import {
    bytesToHex,
    hexToBytes
} from "../tools"
import {
    str2bigInt,
    powMod as powMod_,
    bigInt2str
} from "leemon"

/**
 * PowMod using leemon
 * @param {Uint8Array} b Base
 * @param {number}     e Exponent
 * @param {string}     n Modulus
 * @returns {Uint8Array} Result
 */
const powMod = (b, e, n) => {
    b = str2bigInt(bytesToHex(b), 16)
    e = str2bigInt(e, 16)
    n = str2bigInt(n, 16)

    return hexToBytes(bigInt2str(powMod_(b, e, n), 16), new Uint8Array(256))
}

export {
    powMod
}