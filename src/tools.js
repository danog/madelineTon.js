/**
 * Positive modulo
 * @param {number} a A
 * @param {number} b B
 * @returns number
 */
const posMod = (a, b) => {
    const r = -a % b
    return r < 0 ? r + b : r
}

const byteToHexMap = Array(0xff);

for (let n = 0; n <= 0xff; ++n) {
    let hexOctet = n.toString(16);
    if (hexOctet.length === 1) {
        hexOctet = "0"+hexOctet
    }
    byteToHexMap.push(hexOctet);
}

/**
 * Converts bytes to hex string
 * @param {Uint8Array} bytes Bytes
 */
const bytesToHex = bytes => {
    const arr = Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) {
        arr[i] = byteToHexMap[bytes[i]]
    }
    return arr.join('')
}

export {
    posMod,
    bytesToHex
}