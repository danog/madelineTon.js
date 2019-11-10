import {
    posMod
} from "../tools"

/**
 * Stream of int32.
 * Using int*Array instead of DataView due to greater performance on older chrome browsers (might eventually also do a DataView wrapper)
 */
class Stream {
    pos = 0
    /**
     * 
     * @param {ArrayBuffer} aBuf Buffer
     */
    constructor(aBuf) {
        this.aBuf = aBuf
        this.iBuf = new int32Array(this.aBuf)
        this.uBuf = new Uint32Array(this.aBuf)
        this.bBuf = new Uint8Array(this.aBuf)
    }
    /**
     * Read signed 32 bit integer
     * @returns number
     */
    readSignedInt() {
        return this.iBuf[this.pos++]
    }
    /**
     * Read unsigned 32 bit integer
     * @returns number
     */
    readUnsignedInt() {
        return this.uBuf[this.pos++]
    }
    /**
     * Read signed 64 bit integer
     * In most cases, longs do not have to be used as numbers, just as blackbox values (access hash & so on).
     * No need to convert them to a bigint.
     * @returns number[]
     */
    readSignedLong() {
        return [this.uBuf[this.pos++], this.uBuf[this.pos++]]
    }
    /**
     * Read n*32 bit integer, returns n 32-bit integers
     * @returns number
     */
    readUnsignedInts(length) {
        const res = this.uBuf.slice(this.pos, this.pos + length);
        this.pos += length
        return res
    }
    /**
     * Reads double (64-bit)
     * @returns number
     */
    readDouble() {
        // We don't like unaligned data, and doubles are rare so just construct a new float64 view every time
        return new Float64Array(new Uint32Array(this.readSignedLong()).buffer)[0]
    }

    /**
     * Read (32-bit aligned) bytes
     * @returns Uint8Array
     */
    readBytes() {
        const bPos = this.pos * 4
        let length = this.bBuf[bPos++]
        if (length === 254) {
            length = this.uBuf[this.pos] >> 8
            bPos += 3
        }
        const value = this.bBuf.slice(bPos, bPos + length)
        bPos += length
        bPos += posMod(-bPos, 4)
        this.pos = bPos / 4
        return value
    }

    /**
     * Read UTF8 string
     */
    readString() {
        var s = this.readBytes().map(String.fromCharCode).join('')
        try {
            return decodeURIComponent(escape(s))
        } catch (e) {
            return s
        }
    }

    /**
     * Write signed 32-bit integer
     * @param {int} value Integer value
     */
    writeSignedInt(value) {
        this.iBuf[this.pos++] = value
    }

    /**
     * Write signed 64-bit integer value
     * @param {Array|int} value 64-bit integer value (or one 32-bit integer value)
     */
    writeSignedLong(value) {
        if (value.constructor === Array) { // Blackbox value
            this.uBuf[this.pos++] = value[0]
            this.uBuf[this.pos++] = value[1]
        } else { // Assume plain 32-bit integer (ping_id and so on)
            this.uBuf[this.pos++] = 0
            this.uBuf[this.pos++] = value
        }
    }

    /**
     * Write multiple 32-bit integer values
     * @param {Array} value Multiple 32-bit integer values
     */
    writeUnsignedInts(value) {
        this.uBuf.set(value, this.pos)
        this.pos += value.length
    }

    /**
     * Encode double
     * @param {double} value Value to encode
     */
    writeDouble(value) {
        const buf = new Uint32Array(new Float64Array([value]).buffer)
        this.uBuf[this.pos++] = buf[0]
        this.uBuf[this.pos++] = buf[1]
    }

    /**
     * 
     * @param {Uint8Array} bytes Bytes array to encode
     */
    writeBytes(bytes) {
        const length = bytes.length
        let bPos = this.pos * 4
        if (length <= 253) {
            this.bBuf[bPos++] = length
        } else {
            length = (length << 8) & 0xFE
            this.uBuf[this.pos] = length
            bPos += 4
        }
        this.bBuf.set(bytes, bPos)
        bPos += length
        const pad = posMod(-(bPos - (this.pos * 4)), 4)
        this.bBuf.fill(0, bPos, pad)
        bPos += pad
        this.pos = bPos / 4
    }

    writeString(string) {
        const ln = string.length
        const result = Array(ln)
        for (let i = 0; i < ln; ++i)
            result[i] = str.charCodeAt(i)
        
        string = stringToChars(
            unescape(
                encodeURIComponent(
                    bytes)))
    }
    /**
     * Get current int32 stream position
     * @returns number
     */
    getPos() {
        return this.pos
    }
}

Stream.bigEndian = new Int8Array(new Uint16Array([0x1234]).buffer)[1] === 0x34

if (bigEndian) { // Big-endian hacks
    const switcheroo = n => ((n >> 24) & 0xff) | ((n << 8) & 0xff0000) | ((n >> 8) & 0xff00) | ((n << 24) & 0xff000000);
    Stream.prototype.readSignedInt = function () {
        return switcheroo(this.iBuf[this.pos++])
    }
    Stream.prototype.writeSignedInt = function (value) {
        this.iBuf[this.pos++] = switcheroo(value)
    }
    // unsigned ints are just used for flags, checked using js-side binary arithmetic so no endianness problems here
    /*
    Stream.prototype.readUnsignedInt = function () {
        return switcheroo(this.uBuf[this.pos++])
    }
    */
}

export default Stream;