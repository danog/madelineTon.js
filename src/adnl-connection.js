import ADNL from "./network/adnl";
import CryptoAsync from "./crypto";
import {
    bufferConcat
} from "./tools";
import {
    fastRandom
} from "./crypto-sync/random";
import Parser from "./TL/parser";
import Stream from "./TL/stream";

class ADNLConnection {
    requests = {}
    pings = {}

    /**
     * 
     * @param {Parser} TLParser 
     * @param {Object} endpoint 
     * @param {string} URI
     */
    constructor(TLParser, key, uri) {
        this.TLParser = TLParser
        this.key = key
        this.uri = uri
        this.crypto = new CryptoAsync(this.TLParser)
    }

    async connect() {
        const {
            pub,
            secret
        } = await this.crypto.initEC(this.key['key'])
        let init = await this.crypto.secureRandom(new Uint32Array(40))
        //init = new Uint32Array(hexToBytes('e9c77267d521ec3644410f78d555ecc5857e9a5dc84dc575ac5b611d42b1874696e1b5a0cfe4bc45fb2feccf02061f4df5b5d5be679afe46177d8561aaea8cc37ded93ee999b9e086b0c4d65a519d6000968316e63755d3519818fa941df37ba8bce3dca622c78eedbf04af4253b510fd16df084e6ffc4b5d417aef6443385ff41e12749bbbbd5c770f961db642ca82105e7918427e217129bc4b3c58723da7e').buffer)
        let ctx = {
            crypto: this.crypto,
            decrypt: [init.slice(0, 8), init.slice(16, 20)],
            encrypt: [init.slice(8, 16), init.slice(20, 24)],
            uri: this.uri
        }

        let digest = await this.crypto.sha256(init)

        init = new Uint8Array(init.buffer)
        digest = new Uint8Array(digest)

        const key = bufferConcat(secret.slice(0, 16), digest.slice(16, 32))
        const iv = bufferConcat(digest.slice(0, 4), secret.slice(20, 32))

        const processor = await this.crypto.getCtr(key, iv)
        const encryptedInit = new Uint8Array(await processor.process(init))
        processor.close()

        const id = new Uint8Array(await this.crypto.sha256(this.TLParser.serialize(new Stream, this.key).uBuf))

        ctx['init'] = bufferConcat(
            bufferConcat(
                id,
                pub
            ),
            digest,
            encryptedInit
        )

        let socket = new ADNL
        socket.onClose = () => console.log("Closed connection!")
        socket.onMessage = message => this.onMessage(message)
        try {
            await socket.connect(ctx)
        } catch (e) {
            console.log("connect error: ", e);
        }

        this.socket = socket
        this.pingId = setInterval(() => {
            this.ping()
        }, 5000)
    }

    /**
     * Incoming message
     * @param {Stream} message Incoming message
     */
    onMessage(message) {
        message = this.TLParser.deserialize(message)
        if (message['_'] === 'tcp.pong') {
            this.pings[message['random_id']].res(message)
            delete this.pings[message['random_id']]
            return
        }
        if (message['_'] !== 'adnl.message.answer') {
            console.log("Weird message: ", message)
            return
        }
        clearTimeout(this.requests[message['query_id']]['timeoutId'])
        this.requests[message['query_id']].res(this.TLParser.deserialize(new Stream(message['answer'].buffer)))
        delete this.requests[message['query_id']]
        delete this.socket.onError
    }

    /**
     * Send RLDP query
     * @param {Uint8Array} query Query
     */
    queryRLDP(data) {
        const query_id = fastRandom(new Uint32Array(8))
        data = this.TLParser.serialize(this.socket.getBuffer(), {
            _: 'rldp.query',
            query_id,
            max_answer_size: 1024 * 1024,
            timeout: 10,
            data
        })
        const promise = new Promise((res, rej) => {
            const timeoutId = setTimeout(this.timeout.bind(this), 10000, query_id)
            this.requests[query_id] = {
                res,
                rej,
                timeoutId
            }
        })
        this.socket.onError = (error) => this.timeout(query_id, error);
        return this.socket.write(data).then(() => promise)
    }
    /**
     * Send ADNL query
     * @param {Uint8Array} query Query
     */
    query(query) {
        const query_id = fastRandom(new Uint32Array(8))
        query = this.TLParser.serialize(this.socket.getBuffer(), {
            _: 'adnl.message.query',
            query_id,
            query
        })
        const promise = new Promise((res, rej) => {
            const timeoutId = setTimeout(this.timeout.bind(this), 10000, query_id)
            this.requests[query_id] = {
                res,
                rej,
                timeoutId
            }
        })
        this.socket.onError = (error) => this.timeout(query_id, error);
        return this.socket.write(query).then(() => promise)
    }

    timeout(query_id, error="Timeout!") {
        clearTimeout(this.requests[query_id]['timeoutId'])
        this.requests[query_id].rej(new Error(error))
        delete this.requests[query_id]
    }
    /**
     * Send ping
     */
    ping() {
        if (!this.socket) return
        const random_id = fastRandom(new Int32Array(2))
        const ping = this.TLParser.serialize(this.socket.getBuffer(), {
            _: 'tcp.ping',
            random_id
        })
        const promise = new Promise((res, rej) => {
            this.pings[random_id] = {
                res,
                rej
            }
        })
        return this.socket.write(ping).then(() => promise)
    }

    close() {
        if (this.socket) {
            this.socket.close()
            this.socket = undefined
            clearInterval(this.pingId)
        }
    }
}

export default ADNLConnection;