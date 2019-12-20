import Objects from "./TL/objects";
import Parser from "./TL/parser";
import Stream from "./TL/stream";
import ADNL from "./network/adnl";
import CryptoAsync from "./crypto";
import {
    bufferConcat, bytesToHex, hexToBytes
} from "./tools";

class Lite {
    sockets = {}
    constructor(settings) {
        let config = settings.config
        delete settings.config
        this.settings = settings

        this.TLObjects = new Objects(settings['schemes'])
        this.TLParser = new Parser(this.TLObjects)

        let stream = new Stream

        // This is also a TL serializer test
        config['_'] = 'liteclient.config.global'
        config['validator']['init_block'] = config['validator']['init_block'] || config['validator']['zero_state']
        config = this.TLParser.serialize(stream, config)
        config.pos = 0
        this.config = this.TLParser.deserialize(config)
    }
    connect() {
        let promises = [];
        for (let key in this.config['liteservers']) {
            promises.push(this.connectEndpoint(this.config['liteservers'][key]))
        }
        return Promise.all(promises)
    }
    async connectEndpoint(endpoint) {
        const crypto = new CryptoAsync(this.getTL())
        const {
            pub,
            secret
        } = await crypto.initEC(endpoint['id']['key'])
        let init = await crypto.secureRandom(new Uint32Array(40))
        init = hexToBytes('e9c77267d521ec3644410f78d555ecc5857e9a5dc84dc575ac5b611d42b1874696e1b5a0cfe4bc45fb2feccf02061f4df5b5d5be679afe46177d8561aaea8cc37ded93ee999b9e086b0c4d65a519d6000968316e63755d3519818fa941df37ba8bce3dca622c78eedbf04af4253b510fd16df084e6ffc4b5d417aef6443385ff41e12749bbbbd5c770f961db642ca82105e7918427e217129bc4b3c58723da7e')
        let digest = await crypto.sha256(init)

        init = new Uint8Array(init.buffer)
        digest = new Uint8Array(digest)

        const key = bufferConcat(secret.slice(0, 16), digest.slice(16, 32))
        const iv = bufferConcat(digest.slice(0, 4), secret.slice(20, 32))

        const processor = await crypto.getCtr(key, iv)
        const encryptedInit = new Uint8Array(await processor.process(init))
        processor.close()

        console.log(endpoint['id'])
        const id = new Uint8Array(await crypto.sha256(this.TLParser.serialize(new Stream, endpoint['id']).uBuf))

        const payload = bufferConcat(
            bufferConcat(
                id,
                pub
            ),
            digest,
            encryptedInit
        )

        console.log("1: ", bytesToHex(id))
        console.log("2: ", bytesToHex(pub))
        console.log("3: ", bytesToHex(digest))
        console.log("4: ", bytesToHex(encryptedInit))

        console.log(bytesToHex(payload))

        let socket = new ADNL
        socket.onClose = () => console.log("Closed connection!")
        await socket.connect({
            crypto,
            encrypt: [init.slice(0, 32), init.slice(64, 80)],
            decrypt: [init.slice(32, 64), init.slice(80, 96)],
            uri: this.settings['wssProxies'][endpoint['ip']],
            init: payload,
        })
    }
    methodCall(method, args, aargs) {
        if (aargs['dcId']) {
            this.lastDc = aargs['dcId']
        }
        return this.datacenter.sockets[this.lastDc].methodCall(method, args, aargs)
    }
    getTL() {
        return this.TLParser
    }
}

export default Lite;