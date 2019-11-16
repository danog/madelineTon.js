import {
    posMod,
    transfer
} from "../tools"
/**
 * Stream of int32.
 * Using int*Array instead of DataView due to greater performance on older chrome browsers (might eventually also do a DataView wrapper)
 */
class Stream {
    /**
     * 
     * @param {ArrayBuffer} aBuf Buffer
     */
    constructor(aBuf) {
        this.pos = 0
        this.aBuf = aBuf || new ArrayBuffer
        this.iBuf = new Int32Array(this.aBuf)
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
        let bPos = this.pos * 4
        let length = this.bBuf[bPos++]
        if (length === 254) {
            length = this.readUnsignedInt() >> 8
            bPos += 3
        }
        const value = this.bBuf.slice(bPos, bPos + length)
        bPos += length
        this.pos = Math.ceil(bPos / 4)
        return value
    }

    /**
     * Read UTF8 string
     * @returns string
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
     * @param {number} value Integer value
     * @returns Stream
     */
    writeSignedInt(value) {
        this.iBuf[this.pos++] = value
        return this
    }

    /**
     * Write unsigned 32-bit integer
     * @param {number} value Integer value
     * @returns Stream
     */
    writeUnsignedInt(value) {
        this.uBuf[this.pos++] = value
        return this
    }

    /**
     * Write signed 64-bit integer value
     * @param {Array|number} value 64-bit integer value (or one 32-bit integer value)
     * @returns Stream
     */
    writeSignedLong(value) {
        if (value.constructor === Array) { // Blackbox value
            this.uBuf[this.pos++] = value[0]
            this.uBuf[this.pos++] = value[1]
        } else { // Assume plain 32-bit integer (ping_id and so on)
            this.uBuf[this.pos++] = 0
            this.uBuf[this.pos++] = value
        }
        return this
    }

    /**
     * Write multiple 32-bit integer values
     * @param {Array} value Multiple 32-bit integer values
     * @returns Stream
     */
    writeUnsignedInts(value) {
        this.uBuf.set(value, this.pos)
        this.pos += value.length
        return this
    }

    /**
     * Encode double
     * @param {double} value Value to encode
     * @returns Stream
     */
    writeDouble(value) {
        const buf = new Uint32Array(new Float64Array([value]).buffer)
        this.uBuf[this.pos++] = buf[0]
        this.uBuf[this.pos++] = buf[1]
        return this
    }

    /**
     * Write bytes
     * @param {Uint8Array} bytes Bytes array to encode
     * @returns Stream
     */
    writeBytes(bytes) {
        let length = bytes.length
        let bPos = this.pos * 4
        if (length <= 253) {
            this.bBuf[bPos++] = length
            length++
        } else {
            this.writeUnsignedInt((length << 8) | 0xFE)
            bPos += 4
            length += 4
        }
        length += posMod(-length, 4)
        length /= 4 // Length in int32
        this.prepareLength(length - 1) // One int32 is already allocated by the parser
        this.bBuf.set(bytes, bPos) // No need to fill the padding (prolly)

        this.pos += length
        return this
    }

    /**
     * Encode UTF8 string
     * @param {string} string String to encode
     * @returns Stream
     */
    writeString(string) {
        string = unescape(encodeURIComponent(bytes))

        const ln = string.length
        const result = Uint8Array(ln)
        for (let i = 0; i < ln; ++i) {
            result[i] = str.charCodeAt(i)
        }

        this.writeBytes(result)
        return this
    }
    /**
     * Prepare buffer for serialization adding N more ints of free space
     * @param {number} more 32-bit ints to add
     * @returns Stream
     */
    prepareLength(more) {
        if (!more) return this
        this.aBuf = transfer(this.aBuf, this.aBuf.byteLength + more * 4)
        this.iBuf = new Int32Array(this.aBuf)
        this.uBuf = new Uint32Array(this.aBuf)
        this.bBuf = new Uint8Array(this.aBuf)
        return this
    }
    /**
     * Get current int32 stream size
     * @returns number
     */
    getSize() {
        return this.iBuf.length
    }
    /**
     * Get current byte stream size
     * @returns number
     */
    getByteLength() {
        return this.iBuf.byteLength
    }
    /**
     * Get current int32 stream position
     * @returns number
     */
    getPos() {
        return this.pos
    }
    /**
     * Reset position
     */
    reset() {
        this.pos = 0
        return this
    }
    /**
     * Gets buffer
     * @returns ArrayBuffer
     */
    getBuffer() {
        return this.aBuf
    }
    /**
     * Switch endianness of integer
     * @param {number} n Number
     */
    static switcheroo(n) {
        return ((n >> 24) & 0xff) | ((n << 8) & 0xff0000) | ((n >> 8) & 0xff00) | ((n << 24) & 0xff000000);
    }
}

Stream.bigEndian = new Int8Array(new Uint16Array([0x1234]).buffer)[1] === 0x34

if (Stream.bigEndian) { // Big-endian hacks
    Stream.prototype.readSignedInt = function () {
        return this.switcheroo(this.iBuf[this.pos++])
    }
    Stream.prototype.writeSignedInt = function (value) {
        this.iBuf[this.pos++] = this.switcheroo(value)
    }
    Stream.prototype.readUnsignedInt = function () {
        return this.switcheroo(this.uBuf[this.pos++])
    }
    Stream.prototype.writeUnsignedInt = function (value) {
        this.uBuf[this.pos++] = this.switcheroo(value)
    }
}


export default Stream;