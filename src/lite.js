import Objects from "./TL/objects";
import Parser from "./TL/parser";
import Stream from "./TL/stream";
import ADNL from "./network/adnl";
import CryptoAsync from "./crypto";

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
        console.log(this.config)
    }
    connect() {
        let promises = [];
        for (let key in this.config['liteservers']) {
            this.promises.push(this.connectEndpoint(this.config['liteservers'][key]))
        }
        return Promise.all(promises).then(() => this.sync())
    }
    async connectEndpoint(endpoint) {
        const crypto = new CryptoAsync(this.getTL())
        const init = await crypto.secureRandom(new Uint32Array(32))
        
        let socket = new ADNL
        await socket.connect({
            crypto,
            encrypt: [key, iv],
            decrypt: [keyRev, ivRev],
            uri: this.settings['wssProxies'][endpoint['ip']],
            init,
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