import Socket from "./network"
import Stream from "./TL/stream"
import MessageIdHandler from "./session/messageIdHandler"

class Connection {
    pendingMessages = []
    incomingMessages = {}
    outgoingMessages = {}
    newOutgoing = {}

    toAck = []
    /**
     * 
     * @param {AuthInfo} shared 
     * @param {API} API 
     */
    constructor(authInfo, API) {
        this.authInfo = authInfo
        this.API = API
        this.TL = API.getTL()
        this.mIdHandler = new MessageIdHandler
    }
    /**
     * Connect to datacenter
     * @param {Context} ctx 
     */
    connect(ctx) {
        this.dc = ctx.getDcId()
        console.log(`Connecting to DC ${this.dc}...`)
        this.connection = new Socket
        this.connection.onMessage = this.onMessage.bind(this)
        return this.connection.connect(ctx)
    }
    /**
     * 
     * [
     *     // only in outgoing messages
     *     'body' => deserialized body, (optional if container)
     *     'serialized_body' => 'serialized body', (optional if container)
     *     'contentRelated' => bool,
     *     '_' => 'predicate',
     *     'promise' => deferred promise that gets resolved when a response to the message is received (optional),
     *     'send_promise' => deferred promise that gets resolved when the message is sent (optional),
     *     'file' => bool (optional),
     *     'type' => 'type' (optional),
     *     'queue' => queue ID (optional),
     *     'container' => [message ids] (optional),
     *
     *     // only in incoming messages
     *     'content' => deserialized body,
     *     'seq_no' => number (optional),
     *     'from_container' => bool (optional),
     *
     *     // can be present in both
     *     'response' => message id (optional),
     *     'msg_id' => message id (optional),
     *     'sent' => timestamp,
     *     'tries' => number
     * ]
     * 
     * @param {Message} message Message object
     * @param boolean   flush   Whether to flush
     */
    sendMessage(message, flush = true) {
        if (!message['serialized_body']) {
            let stream = new Stream
            this.TL.serialize(stream, message['body'], {layer: this.API.layer})
            message['serialized_body'] = stream.getBuffer()
        }

        this.pendingMessages.push(message)
        if (flush) {
            return this.flush()
        }
    }

    async methodCall(method, args, aargs) {
        args['_'] = method
        const message = {
            _: method,
            body: args,
            unencrypted: !this.authInfo.hasAuthKey() && !method.includes('.')
        }
        const promise = new Promise((res, rej) => { message['resolve'] = res, message['reject'] = rej})
        await this.sendMessage(message, true)
        return promise
    }
    /**
     * Send pending outgoing messages
     */
    async flush() {
        if (!this.pendingMessages) {
            return
        }
        if (this.authInfo.hasAuthKey()) { // Encrypted write loop
            await this.flushEncrypted()
        } else { // Unencrypted
            await this.flushPlain()
        }
    }
    async flushPlain() {
        for (const key in this.pendingMessages) {
            const message = this.pendingMessages[key]
            if (this.authInfo.hasAuthKey()) {
                return
            }
            if (!message['unencrypted']) {
                continue
            }
            const length = message['serialized_body'].byteLength

            const buffer = new Uint32Array((length / 4) + 5)
            buffer.fill(0, 0, 1)

            let messageId = message['msg_id'] || this.mIdHandler.generate()
            buffer[2] = messageId.low_
            buffer[3] = messageId.high_
            buffer[4] = message['serialized_body'].byteLength
            buffer.set(new Uint32Array(message['serialized_body']), 5)

            await this.connection.write(buffer)
            message['sent'] = Date.now() / 1000
            message['tries']  = 0

            delete this.pendingMessages[key]
            this.outgoingMessages[messageId.toString()] = message
            this.newOutgoing[messageId.toString()] = messageId
            
            console.log(`Sent ${message['_']} as unencrypted message to DC ${this.dc}!`)
        }
    }
    async flushEncrypted() {

    }
    /**
     * Parse incoming message
     * @param {ArrayBuffer} message 
     */
    onMessage(message) {
        console.log("got message")
        if (message.byteLength === 4) {
            const error = new Stream(message).readSignedInt()
            if (error === -404) {
                if (this.authInfo.hasAuthKey()) {
                    console.log("Resetting auth key in DC " + this.dc)
                    this.authInfo.setAuthKey(undefined)
                    this.resetSession()

                }
            }
        }
        
    }

}

export default Connection;