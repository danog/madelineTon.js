import Stream from "../TL/stream"

/**
 * Increment AES CTR counter (big endian machines)
 * @param {number} by Increment by
 */
const incCounter = by => {
    for (let x = 3; x >= 0; x--) {
        let tmp = this.counter[x] + by
        if (tmp > 0xFFFFFFFF) {
            this.counter[x] = tmp & 0xFFFFFFFF
            by = 1 // Assume increment is always < 0xFFFFFFFF
        } else {
            this.counter[x] = tmp
            return
        }
    }
}
/**
 * Increment AES CTR counter (little endian machines)
 * @param {number} by Increment by
 */
const incCounterLittleEndian = by => {
    for (let x = 3; x >= 0; x--) {
        let tmp = Stream.prototype.switcheroo(this.counter[x]) + by
        if (tmp > 0xFFFFFFFF) {
            this.counter[x] = Stream.prototype.switcheroo(tmp & 0xFFFFFFFF)
            by = 1 // Assume increment is always < 0xFFFFFFFF
        } else {
            this.counter[x] = Stream.prototype.switcheroo(tmp)
            return
        }
    }
}
if (!Stream.bigEndian) {
    incCounter = incCounterLittleEndian
}

export {
    incCounter
}