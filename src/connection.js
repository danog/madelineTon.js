import Socket from "./network"
import Stream from "./TL/stream"
import MessageIdHandler from "./session/messageIdHandler"

class Connection {
    pendingMessages = []
    incomingMessages = {}
    outgoingMessages = {}
    newOutgoing = {}
    newIncoming = {}

    toAck = []
    connected = false

    inSeqNo = 0
    outSeqNo = 0

    /**
     * Reset MTProto session
     */
    async resetSession() {
        this.sessionId = await this.crypto.secureRandom(new Uint32Array(2))
        this.inSeqNo = 0
        this.outSeqNo = 0
        this.mIdHandler = new MessageIdHandler
    }
    /**
     * Create MTProto session if needed
     */
    async createSession() {
        if (typeof this.sessionId === 'undefined') {
            this.sessionId = await this.crypto.secureRandom(new Uint32Array(2))
            this.inSeqNo = 0
            this.outSeqNo = 0
        }
    }
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
        this.ctx = ctx
        this.crypto = ctx.getCrypto()
        console.log(`Connecting to DC ${this.dc}...`)
        this.connection = new Socket
        this.connection.onMessage = this.onMessage.bind(this)
        this.connection.onClose = () => this.connected = false
        return this.connection.connect(ctx).then(() => this.connected = true)
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
            if (message['unencrypted']) {
                message['type'] = this.TL.objects.findByPredicateAndLayer(message['_'])['type']
            }
            let stream = this.connection.getBuffer()
            this.TL.serialize(stream, message['body'], {
                layer: this.API.layer
            })
            stream.pos = stream.initPos + 4
            stream.writeUnsignedInt(stream.getByteLength() - (5 + stream.initPos) * 4)
            stream.pos = stream.initPos

            message['serialized_body'] = stream
        }

        this.pendingMessages.push(message)
        if (flush) {
            return this.flush()
        }
    }

    /**
     * 
     * @param {string} method Method name
     * @param {Object} args   Arguments 
     * @param {Object} aargs  Additional arguments
     */
    async methodCall(method, args, aargs) {
        args['_'] = method
        const message = {
            _: method,
            method: true,
            body: args,
            unencrypted: !this.authInfo.hasAuthKey() && !method.includes('.')
        }
        const promise = new Promise((res, rej) => {
            message['resolve'] = res, message['reject'] = rej
        })
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
        const pendingMessages = this.pendingMessages
        this.pendingMessages = []
        for (const key in pendingMessages) {
            const message = pendingMessages[key]
            if (this.authInfo.hasAuthKey()) {
                return
            }
            if (!message['unencrypted']) {
                continue
            }

            let messageId = message['msg_id'] || this.mIdHandler.generate()
            console.log(message['serialized_body'].uBuf)
            message['serialized_body'].pos = message['serialized_body'].initPos + 2
            console.log(messageId)
            message['serialized_body'].writeSignedLong([messageId.low_, messageId.high_])
            message['serialized_body'].pos = message['serialized_body'].initPos
            console.log(message['serialized_body'].uBuf)

            await this.connection.write(message['serialized_body'])
            
            message['sent'] = Date.now() / 1000
            message['tries'] = 0

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
        console.log("Got message")
        //console.log(message)

        //console.log(message.getByteLength())
        if (message.getByteLength() === 4) {
            const error = message.readSignedInt()
            throw new Error(error)
            if (error === -404) {
                if (this.authInfo.hasAuthKey()) {
                    console.log("Resetting auth key in DC " + this.dc)
                    this.authInfo.setAuthKey(undefined)
                    this.resetSession()

                }
            }
        }
        let authKey = message.readSignedLong()
        let mId
        if (authKey[0] + authKey[1] === 0) {
            mId = this.mIdHandler.check(message.readSignedLong())
            message.pos++ // Skip length, framing is handled correctly by both HTTP and websockets anyway
        } else {

        }
        this.incomingMessages[mId] = this.TL.deserialize(message)
        this.newIncoming[mId] = mId
        this.handleMessages()
    }

    handleMessages() {
        while (Object.keys(this.newIncoming).length) {
            var message, mId
            for (let key in this.newIncoming) { // Avoid problems with multiple competing calls
                mId = key
                message = this.incomingMessages[key]
                delete this.incomingMessages[key]
                delete this.newIncoming[key]
                break
            }

            console.log(`Received ${message['_']} from DC ${this.dc}`)

            switch (message['_']) {
                case 'msgs_ack':
                    console.log(`msgs_ack: ${message}`)
                    break
                case 'rpc_result':
                    this.toAck.push(mId)
                    this.handleResponse(mId, message)
                    break
                case 'future_salts':
                case 'msgs_state_info':
                    var msg_id_type = 'req_msg_id';
                    // no break
                case 'bad_server_salt':
                case 'bad_msg_notification':
                    var msg_id_type = msg_id_type ? msg_id_type : 'bad_msg_id';
                    // no break
                case 'pong':
                    var msg_id_type = msg_id_type ? msg_id_type : 'msg_id';
                    this.handleResponse(message[msg_id_type], message)
                    break
                case 'new_session_created':
                    console.log(`new_session_created: ${message}`)
                    break
                case 'msg_container':
                    for (mId in message['messages']) {
                        this.mIdHandler.check(mId, true)
                        this.incomingMessages[mId] = message['messages'][mId]
                        this.newIncoming[mId] = mId
                    }
                    break
                default:
                    var type = this.TL.objects.findByPredicateAndLayer(message['_'])['type']
                    if (type === 'Updates') { // Do update handling stuffs
                        break
                    }
                    //console.log(`Trying to assing a raw response of type ${type} to its request...`)
                    for (let rId in this.newOutgoing) {
                        //console.log(`Does the request of return type ${this.outgoingMessages[rId]['type']} match?`)
                        if (this.outgoingMessages[rId]['type'] === type) {
                            //console.log('Yes')
                            this.handleResponse(rId, message)
                            break
                        }
                        //console.log('No')
                    }
            }
        }
    }

    handleResponse(reqId, response) {
        var request = this.outgoingMessages[reqId]
        if (typeof request === 'undefined') {
            console.log(`Could not find request for reqId ${reqId}`)
            return
        }
        if (typeof response['_'] !== undefined) { // Might be a vector return type
            switch (response['_']) {
                case 'rpc_error':

            }
        }
        if (request['method'] && request['_'] === 'auth.bindTempAuthKey' && this.authInfo.hasAuthKey() && !this.authInfo.getAuthKey().isInited()) {
            this.authInfo.getAuthKey().init(true)
        }
        if (!request['resolve']) {
            console.log(`Already resolved ${response['_'] ? response['_'] : '-'}`)
            return
        }
        if (response['_'] && this.TL.objects.findByPredicateAndLayer(request['_'])['type'] === 'Updates') {
            response['request'] = request // For better peer resolution in results of method calls
            // Here should call update handler
        }
        this.gotResponseForOutgoingMessageId(reqId)
        const r = request['resolve']
        delete request['reject']
        delete request['resolve']
        r(response)
    }
    gotResponseForOutgoingMessageId(id) {
        if (this.newOutgoing[id]) {
            delete this.newOutgoing[id]
        }
        if (this.outgoingMessages[id]['body']) {
            delete this.outgoingMessages[id]['body']
        }
        if (this.outgoingMessages[id]['serialized_body']) {
            delete this.outgoingMessages[id]['serialized_body']
        }
    }
}

export default Connection;