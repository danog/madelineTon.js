import Stream from "../TL/stream"
import { posMod } from "../tools"

/**
 * Stream of bits.
 */
class BitStream {
    /**
     * Construct stream
     * @param {ArrayBuffer} aBuf Buffer
     */
    constructor(aBuf) {
        this.pos = 0 // In bits
        this.aBuf = aBuf || new ArrayBuffer(128) // Max length for cells
        this.bBuf = new Uint8Array(this.aBuf)
    }
    /**
     * Write bits to stream
     * @param {number|Uint8Array} n      Number to write
     * @param {number}            length Bit length of field
     */
    writeBits(n, length) {
        let byteLength = Math.ceil(length / 8)

        if (!(n instanceof Uint8Array)) {
            if (!Stream.bigEndian) {
                n = Stream.switcheroo(n)
            }
            n = new Uint8Array(new Uint32Array([n]).buffer).subarray(-byteLength)
        }

        let inputShift = 8 - (length & 7)
        length += inputShift
        for (let bitPos = inputShift; bitPos < length; bitPos++, this.pos++) {
            //console.log(n, bitPos, bitPos >> 3, bitPos & 7, n[bitPos >> 3], (n[bitPos >> 3] >> (8 - ((bitPos & 7) + 1))) & 1)
            this.bBuf[this.pos >> 3] |= ((n[bitPos >> 3] >> (8 - ((bitPos & 7) + 1))) & 1) << (8 - ((this.pos & 7) + 1))
        }

        return this
    }
    /**
     * Read bits from stream
     * @param {number} length Number of bits to read
     * @returns {Uint8Array} Bitstring
     */
    readBits(length) {
        let result = new Uint8Array(Math.ceil(length / 8))
        let inputShift = posMod(-(length & 7), 8)
        length += inputShift
        for (let bitPos = inputShift; bitPos < length; bitPos++, this.pos++) {
            //console.log(this.bBuf, bitPos, bitPos >> 3, bitPos & 7, this.bBuf[bitPos >> 3], (this.bBuf[bitPos >> 3] >> (8 - ((bitPos & 7) + 1))) & 1)
            result[bitPos >> 3] |= ((this.bBuf[this.pos >> 3] >> (8 - ((this.pos & 7) + 1))) & 1) << (8 - ((bitPos & 7) + 1))
        }

        return result
    }
    /**
     * Prepare buffer for serialization adding N more bits of free space
     * Shouldn't be used much, if at all
     * 
     * @param {number} more bits to add
     * @returns Stream
     */
    prepareLength(more) {
        if (!more) return this
        this.aBuf = transfer(this.aBuf, this.aBuf.byteLength + Math.ceil(more / 8))
        this.bBuf = new Uint8Array(this.aBuf)
        return this
    }

}

BitStream.bigEndian = Stream.bigEndian

export default BitStream;