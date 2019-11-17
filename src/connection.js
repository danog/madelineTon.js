import Socket from "./network"
import Stream from "./TL/stream"
import MessageIdHandler from "./session/messageIdHandler"
import Http from "./network/http"
import {
    transfer,
    posMod,
    bufferConcat,
    hexToBytes,
    bytesToHex
} from "./tools"
import {
    fastRandom
} from "./crypto-sync/random"

const NOT_CONTENT_RELATED = [
    //'rpc_result',
    //'rpc_error',
    'rpc_drop_answer',
    'rpc_answer_unknown',
    'rpc_answer_dropped_running',
    'rpc_answer_dropped',
    'get_future_salts',
    'future_salt',
    'future_salts',
    'ping',
    'pong',
    'ping_delay_disconnect',
    'destroy_session',
    'destroy_session_ok',
    'destroy_session_none',
    //'new_session_created',
    'msg_container',
    'msg_copy',
    'gzip_packed',
    'http_wait',
    'msgs_ack',
    'bad_msg_notification',
    'bad_server_salt',
    'msgs_state_req',
    'msgs_state_info',
    'msgs_all_info',
    'msg_detailed_info',
    'msg_new_detailed_info',
    'msg_resend_req',
    'msg_resend_ans_req',
]
class Connection {
    incomingMessages = {}
    outgoingMessages = {}
    newOutgoing = {}
    newIncoming = {}

    pendingOutgoingMessages = {}
    pendingOutgoingKey = 0

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
     * Check if is content related
     * @param {string} constructor
     * @boolean True if content related 
     */
    contentRelated(constructor) {
        return !(NOT_CONTENT_RELATED.includes(constructor))
    }
    /**
     * 
     * @param {boolean} contentRelated Whether is content related
     * @returns {number} Seqno
     */
    generateOutSeqNo(contentRelated) {
        let value = this.outSeqNo
        this.outSeqNo += contentRelated
        return value * 2 + contentRelated
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
    getBuffer() {
        return this.authInfo.hasAuthKey() ? new Stream() : this.connection.getBuffer()
    }
    /**
     * 
     * [
     *     // only in outgoing messages
     *     'body' => deserialized body, (optional if container)
     *     'serializedBody' => 'serialized body', (optional if container)
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
        if (!message['serializedBody']) {
            if (message['unencrypted']) {
                message['type'] = this.TL.objects.findByPredicateAndLayer(message['_'])['type']
            }
            let stream = this.getBuffer()
            this.TL.serialize(stream, message['body'], {
                layer: this.API.layer
            })
            stream.pos = stream.initPos + 4
            stream.writeUnsignedInt(stream.getByteLength() - (5 + stream.initPos) * 4)
            stream.pos = stream.initPos

            message['serializedBody'] = stream
        }

        this.pendingOutgoingMessages[this.pendingOutgoingKey++] = message
        //this.pendingOutgoingKey %= 0xFFFFFFFF

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
            unencrypted: !this.authInfo.hasAuthKey() && !method.includes('.'),
            contentRelated: this.contentRelated(method),
            ...aargs
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
        if (this.authInfo.hasAuthKey()) { // Encrypted write loop
            await this.flushEncrypted()
        } else { // Unencrypted
            await this.flushPlain()
        }
    }
    async flushPlain() {
        if (!Object.keys(this.pendingOutgoingMessages).length) {
            return
        }
        const pendingMessages = this.pendingOutgoingMessages
        this.pendingOutgoingMessages = {}
        this.pendingOutgoingKey = 0
        for (const key in pendingMessages) {
            const message = pendingMessages[key]
            if (this.authInfo.hasAuthKey()) {
                return
            }
            if (!message['unencrypted']) {
                continue
            }

            let messageId = message['msg_id'] || this.mIdHandler.generate()
            message['serializedBody'].pos = message['serializedBody'].initPos + 2
            message['serializedBody'].writeSignedLong([messageId.low_, messageId.high_])
            message['serializedBody'].pos = message['serializedBody'].initPos

            await this.connection.write(message['serializedBody'])

            message['sent'] = Date.now() / 1000
            message['tries'] = 0

            this.outgoingMessages[messageId.toString()] = message
            this.newOutgoing[messageId.toString()] = messageId

            console.log(`Sent ${message['_']} as unencrypted message to DC ${this.dc}!`)
        }
    }
    async flushEncrypted() {
        let skipped = false
        let hasVal = false
        do {
            if (!this.authInfo.hasAuthKey()) {
                return
            }
            if (this.connection instanceof Http && !Object.keys(this.pendingOutgoingMessages).length) {
                return
            }
            let temporaryKeys = []

            if (this.toAck.length) {
                for (let x = 0; x < this.toAck.length; x += 8192) {
                    console.log(`Adding msgs_ack ${this.pendingOutgoingKey}`)
                    this.pendingOutgoingMessages[this.pendingOutgoingKey] = {
                        contentRelated: false,
                        unencrypted: false,
                        method: false,
                        serializedBody: this.TL.serialize(new Stream, {
                            _: msgs_ack,
                            msg_ids: this.toAck.slice(x, x + 8192)
                        })
                    }
                    temporaryKeys.push(this.pendingOutgoingKey)
                    this.pendingOutgoingKey++
                }
            }
            let hasHttpWait = false
            if (this.connection instanceof Http) {
                for (let k in this.pendingOutgoingMessages) {
                    if (this.pendingOutgoingMessages[k]['_'] === 'http_wait') {
                        hasHttpWait = true
                    }
                }
                if (!hasHttpWait) {
                    console.log(`Adding http_wait ${this.pendingOutgoingKey}`)
                    this.pendingOutgoingMessages[this.pendingOutgoingKey] = {
                        _: 'http_wait',
                        serializedBody: this.TL.serialize(new Stream, {
                            _: http_wait,
                            max_wait: 30000,
                            wait_after: 0,
                            max_delay: 0
                        }),
                        contentRelated: true,
                        unencrypted: false,
                        method: true
                    }
                    temporaryKeys.push(this.pendingOutgoingKey)
                    this.pendingOutgoingKey++
                    temporaryKeys.push(this.pendingOutgoingKey)
                }
            }


            let keys = []
            let totalLength = 0
            let count = 0
            let inited = false
            let messages = []

            for (let k in this.pendingOutgoingMessages) {
                let message = this.pendingOutgoingMessages[k]
                if (message['unencrypted']) continue
                if (message['container']) {
                    delete this.pendingOutgoingMessages[k]
                    continue
                }
                // This isn't used for now
                /*
                if (this.API.settings.pfs && !this.authInfo.bound() && message['method'] && !['http_wait', 'auth.bindTempAuthKey'].contains(message['_'])) {
                    console.log(`Skipping {$message['_']} due to unbound keys in DC {$datacenter}`);
                    skipped = true;
                    continue;
                }*/
                let actualLength = message['serializedBody'].getByteLength() + 32
                if (totalLength && totalLength + actualLength > 32760 || count >= 1020) {
                    console.log('Length overflow, postponing part of payload');
                    break;
                }

                let messageId = message['messageId'] || this.mIdHandler.generate()
                console.log(`Sending ${message['_']} as encrypted message to DC ${this.dc}`)
                let MTmessage = {
                    _: 'message', // layer 1
                    msg_id: messageId,
                    body: message['serializedBody'].bBuf,
                    seqno: this.generateOutSeqNo(message['contentRelated'])
                }
                if (message['method'] && message['_'] !== 'http_wait') {
                    if (!this.authInfo.getAuthKey(true).isInited() && message['_'] !== 'auth.bindTempAuthKey' && !inited) {
                        inited = true
                        console.log(`Writing client info by wrapping ${message['_']}`)
                        MTmessage['body'] = this.TL.serialize(new Stream, {
                            _: 'invokeWithLayer',
                            layer: this.API.layer,
                            query: this.TL.serialize(new Stream, {
                                _: 'initConnection',
                                api_id: 683677,
                                api_hash: '6e1ce1db80b068b718fe39fd0523d433',
                                device_model: navigator.userAgent || 'Unknown UserAgent',
                                system_version: navigator.platform || 'Unknown Platform',
                                app_version: 1,
                                system_lang_code: navigator.language || 'en',
                                lang_pack: '',
                                lang_code: navigator.language || 'en',
                                query: MTmessage['body']
                            }).bBuf
                        }).bBuf
                    }
                }

                actualLength = MTmessage['body'].byteLength + 32
                if (totalLength && totalLength + actualLength > 32760) {
                    console.log('Length overflow, postponing part of payload');
                    break;
                }
                count++
                totalLength += actualLength

                MTmessage['bytes'] = MTmessage['body'].byteLength
                messages.push(MTmessage)
                keys[k] = messageId
            }

            let messageData, messageId, seqNo
            if (count > 1) {
                console.log(`Wrapping in msg_container ${count} message of total length ${totalLength} as encrypted message for DC ${this.dc}`)

                messageId = this.mIdHandler.generate()
                this.pendingOutgoingMessages[this.pendingOutgoingKey] = {
                    _: 'msg_container',
                    container: keys,
                    contentRelated: false,
                    method: false,
                    unencrypted: false
                }
                keys[this.pendingOutgoingKey++] = messageId

                messageData = this.TL.serialize(new Stream, {
                    _: 'msg_container',
                    messages
                }, {
                    layer: 1
                }).bBuf

                seqNo = this.generateOutSeqNo(false)
            } else if (count) {
                let message = messages[0]
                messageData = message['body']
                messageId = message['msg_id']
                seqNo = message['seqno']
            } else {
                console.warn(`No message was sent in DC ${this.dc}`)
                return
            }

            messages = undefined
            let length = messageData.byteLength

            let plainLength = 32 + length
            let padding = posMod(-plainLength, 16)
            if (padding < 12) {
                padding += 16
            }
            let buffer = new Stream(new Uint8Array(plainLength + padding).buffer)
            buffer.writeUnsignedInts(this.authInfo.getAuthKey().getServerSalt())
            buffer.writeUnsignedInts(this.sessionId)
            buffer.writeSignedLong([messageId.low_, messageId.high_])
            buffer.writeUnsignedInt(seqNo)
            buffer.writeUnsignedInt(length)
            buffer.bBuf.set(messageData, 32)
            fastRandom(buffer.bBuf.subarray(plainLength))

            let authKey = this.authInfo.getAuthKey().getAuthKey()
            let sha = await this.crypto.sha256(bufferConcat(authKey.subarray(88, 120), buffer.bBuf))
            let messageKey = new Uint8Array(sha).slice(8, 24)

            let pair = await this.crypto.aesCalculate(messageKey, authKey)

            let cipher = this.connection.getBuffer(1 + buffer.uBuf.length)
            cipher.pos = cipher.initPos
            cipher.writeUnsignedInts(this.authInfo.getAuthKey().getID())
            cipher.writeUnsignedInts(new Uint32Array(messageKey.buffer))
            cipher.writeUnsignedInts(new Uint32Array(await this.crypto.igeEncrypt(buffer.uBuf, pair[0], pair[1])))


            this.connection.write(cipher)
            let sent = Math.floor(Date.now() / 1000)
            if (this.toAck.length) {
                this.toAck = []
            }
            for (let k in keys) {
                let mId = keys[k]
                this.outgoingMessages[mId] = this.pendingOutgoingMessages[k]
                if (this.outgoingMessages[mId]['resolve']) {
                    this.outgoingMessages[mId]['sent'] = sent
                    this.outgoingMessages[mId]['tries'] = 0
                }
                delete this.pendingOutgoingMessages[k]
            }
            console.log(`Sent encrypted payload to DC ${this.dc}`)
        } while ((hasVal = Object.keys(this.pendingOutgoingMessages).length) && !skipped)
        if (!hasVal) {
            this.pendingOutgoingKey = 0
        }
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
            message.pos++ // Skip length, framing is handled correctly by bodelaysth HTTP and websockets anyway
        } else {

        }

        this.incomingMessages[mId] = this.TL.deserialize(message)
        this.newIncoming[mId] = mId
        this.handleMessages()

        // It might be worth moving the entire Connection module into a worker to avoid main thread delays due to GZIP decoding.
        // Could implement later.
        // Could also make the deserialize function an async function, but I really don't like to have regenerator runtime for such a vital and heavily used function.
        /*
        this.crypto.deserialize(message).then(message => {
            this.incomingMessages[mId] = message
            this.newIncoming[mId] = mId
            this.handleMessages()
        })*/
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
        if (this.outgoingMessages[id]['serializedBody']) {
            delete this.outgoingMessages[id]['serializedBody']
        }
    }
}

export default Connection;