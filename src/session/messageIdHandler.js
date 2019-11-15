import Long from '../lib/bigint/long'

class MessageIdHandler
{
    constructor() {
        this.maxIncoming = new Long(0, 0)
        this.maxOutgoing = new Long(0, 0)
    }
    /**
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