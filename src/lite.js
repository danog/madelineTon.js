import Objects from "./TL/objects";
import Parser from "./TL/parser";
import Stream from "./TL/stream";
import ADNLConnection from "./adnl-connection";
import { fastRandomInt } from "./crypto-sync/random";

class Lite {
    connections = []
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
        for (const key in this.config['liteservers']) {
            const uri = this.settings['wssProxies'][this.config['liteservers'][key]['ip']]
            const connection = new ADNLConnection(this.getTL(), this.config['liteservers'][key]['id'], uri)
            promises.push(connection.connect().then(() => this.connections.push(connection)))
        }
        return Promise.all(promises)
    }
    onMessage(message) {
        console.log(message)
    }
    methodCall(method, args = {}) {
        args['_'] = method
        let data
        data = this.TLParser.serialize(new Stream, args).bBuf
        data = this.TLParser.serialize(new Stream, {
            _: 'liteServer.query',
            data
        }).bBuf

        return this.connections[fastRandomInt(this.connections.length)].query(data)
    }
    getTL() {
        return this.TLParser
    }
}

export default Lite;