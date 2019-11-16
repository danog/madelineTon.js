import Long from '../lib/bigint/long'

class MessageIdHandler
{
    constructor() {
        this.maxIncoming = new Long(0, 0)
        this.maxOutgoing = new Long(0, 0)
    }
    /**
     * Check incoming message ID
     * @param {number[]} id 
     */
    check(id) {
         id = new Long(id[0], id[1])
        const min = new Long(0, Date.now() / 1000 - 300)
        if (min.compare(id) > 0) {
            throw new Error(`Given message ID (${id}) is too old compared to the min value (${min})`)
        }
        const max = new Long(0, Date.now() / 1000 + 30)
        if (max.compare(id) < 0) {
            throw new Error(`Given message ID (${id}) is too new compared to the max value (${max})`)
        }
        const and = id.and(Long.THREE).low_
        if (and != 1 && and != 3) {
            throw new Error(`Given message ID mod 4 != 1 or 3`)
        }
        if (id.compare(this.maxIncoming) <= 0) {
            throw new Error(`Duplicate message ID (${id})`)
        }
        this.maxIncoming = id
    }
    /**
     * Generate outgoing message ID
     * @returns Long
     */
    generate() {
        let id = new Long(0, Date.now() / 1000)
        if (id.compare(this.maxOutgoing) <= 0) {
            id = this.maxOutgoing.add(Long.FOUR)
        }
        return this.maxOutgoing = id
    }
}

export default MessageIdHandler