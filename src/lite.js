import Objects from "./TL/objects";
import Parser from "./TL/parser";
import Stream from "./TL/stream";
import ADNLConnection from "./adnl-connection";
import {
    fastRandomInt
} from "./crypto-sync/random";

class Lite {
    min_ls_version = 0x101
    min_ls_capabilities = 1
    server = {
        ok: false
    }

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
    async connect() {
        // Connect to all liteservers
        let promises = [];
        for (const key in this.config['liteservers']) {
            const uri = this.settings['wssProxies'][this.config['liteservers'][key]['ip']]
            const connection = new ADNLConnection(this.getTL(), this.config['liteservers'][key]['id'], uri)
            promises.push(connection.connect().then(() => this.connections.push(connection)))
        }
        await Promise.all(promises)

        // Parse server version
        const server = await this.methodCall('liteServer.getVersion')
        this.setServerVersion(server)
        this.setServerTime(server.now)

        // Get masterchain info
        const mode = (server.capabilities[0] & 2) ? 0 : -1;
        const info = await this.methodCall(
            mode < 0 ? 'liteServer.getMasterchainInfo' : 'liteServer.getMasterchainInfoExt', {
                mode,
            }
        )

        const last = info.last
        const zero = info.init
        const last_utime = info.last_utime || 0
        if (info['_'] === 'liteServer.masterchainInfoExt') {
            this.setServerVersion(info)
            this.setServerTime(info.now)

            if (last_utime > this.serverTime) {
                console.error(`server claims to have a masterchain block ${JSON.stringify(last)} created at ${last_utime} (${last_utime - this.serverTime} seconds in the future)`)
            } else if (last_utime < this.serverTime - 60) {
                console.error(`server appears to be out of sync: its newest masterchain block is ${JSON.stringify(last)} created at ${last_utime} (${server_now - last_utime} seconds ago according to the server's clock)`)
            } else if (last_utime < this.gotServerTimeAt - 60) {
                console.error(`either the server is out of sync, or the local clock is set incorrectly: the newest masterchain block known to server is ${JSON.stringify(last)} created at ${last_utime} (${server_now - this.gotServerTimeAt} seconds ago according to the local clock)`)
            }
        }

        if (this.config.validator.zero_state !== zero) {
            console.log(this.config)
            console.error(`Zerostate changed: should be ${JSON.stringify(this.config.validator.zero_state)}, is ${JSON.stringify(zero)}`)
            throw new Error("Zerostate changed!")
        }
        console.log(info)
    }
    setServerVersion(server) {
        console.log(`Server version is ${server.version >> 8}.${server.version & 0xFF}, capabilities ${server.capabilities}`)

        this.server = server
        this.server.ok = (server.version >= this.min_ls_version) && !(~server.capabilities[0] & this.min_ls_capabilities);
        if (!this.server.ok) {
            console.error(`Server version is too old (at least ${this.min_ls_version >>8}.${this.min_ls_version & 0xFF} with capabilities ${this.min_ls_capabilities} required), some queries are unavailable!`)
        }
    }
    setServerTime(time) {
        console.log(`Server time is ${time}`)
        this.serverTime = time
        this.gotServerTimeAt = Date.now() / 1000 | 0
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