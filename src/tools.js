/**
 * Positive modulo
 * @param {number} a A
 * @param {number} b B
 * @returns number
 */
const posMod = (a, b) => {
    const r = a % b
    return r < 0 ? r + b : r
}

const byteToHexMap = Array(0xff);

for (let n = 0; n <= 0xff; ++n) {
    let hexOctet = n.toString(16);
    if (hexOctet.length === 1) {
        hexOctet = "0" + hexOctet
    }
    byteToHexMap[n] = hexOctet;
}

/**
 * Converts bytes to hex string
 * @param {Uint8Array} bytes Bytes
 * @returns string
 */
const bytesToHex = bytes => {
    const length = bytes.length
    const arr = Array(length)
    for (let i = 0; i < length; i++) {
        arr[i] = byteToHexMap[bytes[i]]
    }
    return arr.join('')
}

/**
 * Converts hex string to Uint8Array
 * @param {string} hex Hex
 * @param {Uint8Array} out Output array
 */
const hexToBytes = (hex, out) => {
    out = out || new Uint8Array(hex.length / 2)
    const length = out.length
    for (let x = 0; x < length; x++) {
        out[x] = parseInt(hex[x*2].concat(hex[x*2+1]), 16)
    }
    return out
}

/**
 * XOR all elements in two BufferViews, a will be modified to contain the new values
 * @param {ArrayBufferView} a 
 * @param {ArrayBufferView} b 
 */
const xorInPlace = (a, b) => {
    for (let x = 0; x < a.length; x++) {
        a[x] = a[x] ^ b[x]
    }
}

/**
 * Check it two ArrayBufferViews are equal
 * @param {ArrayBufferView} a 
 * @param {ArrayBufferView} b 
 */
const bufferViewEqual = (a, b) => {
    const length = a.length
    if (length != b.length) return false
    for (let x = 0; x < length; x++) {
        if (a[x] != b[x]) {
            return false
        }
    }
    return true
}

/**
 * Concatenate two buffers
 * @param {Uint8Array} a 
 * @param {Uint8Array} b 
 */
const bufferConcat = (a, b) => {
    let res = new Uint8Array(a.byteLength+b.byteLength)
    res.set(a)
    res.set(b, a.byteLength)
    return res
}

/**
 * Resize buffer
 * @param {ArrayBuffer} source Source buffer
 * @param {number}      length New length
 */
const transferPoly = function (source, length) {
    if (length <= source.byteLength)
        return source.slice(0, length);
    var sourceView = new Uint8Array(source),
        destView = new Uint8Array(new ArrayBuffer(length));
    destView.set(sourceView);
    return destView.buffer;
};

const transfer = ArrayBuffer.transfer || transferPoly

export {
    posMod,
    bytesToHex,
    xorInPlace,
    transfer,
    bufferViewEqual,
    hexToBytes,
    bufferConcat
}