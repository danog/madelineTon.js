import Objects from "./TL/objects";
import Parser from "./TL/parser";
import Stream from "./TL/stream";
import ADNLConnection from "./adnl-connection";
import {
    fastRandomInt
} from "./crypto-sync/random";
import deepEqual from 'deep-equal'
import {
    bufferViewEqual,
    atobInt8
} from "./tools";
import CryptoAsync from "./crypto";
import {
    crc16
} from "./crypto-sync/crypto";
import schemeTON from './config/ton_api.json'
import schemeLite from './config/lite_api.json'
import liteConfig from './config/ton-lite-client-test1.config.json'
import BitStream from "./boc/bitstream";

class Lite {
    min_ls_version = 0x101
    min_ls_capabilities = 1
    server = {
        ok: false
    }

    knownBlockIds = []
    printedBlockIds = 0

    connections = []
    constructor(settings) {
        settings = {
            ...settings,
            schemes: {
                1: schemeTON,
                2: schemeLite
            },
            config: liteConfig,
            wssProxies: {
                861606190: 'wss://ton-ws.madelineproto.xyz/testnetDebug',
                1137658550: 'wss://ton-ws.madelineproto.xyz/testnet'
            }
        }
        let config = settings.config
        delete settings.config
        this.settings = settings

        this.TLObjects = new Objects(settings['schemes'])
        this.TLParser = new Parser(
            this.TLObjects, {
                typeConversion: {
                    'liteServer.AccountId': data => this.unpackAccountId(data)
                }
            }
        )

        let stream = new Stream

        // This is also a TL serializer test
        config['_'] = 'liteclient.config.global'
        config['validator']['init_block'] = config['validator']['init_block'] || config['validator']['zero_state']
        config = this.TLParser.serialize(stream, config)
        config.pos = 0
        this.config = this.TLParser.deserialize(config)

        this.crypto = new CryptoAsync(this.TLParser)
    }
    /**
     * Unpack account ID to a liteServer.accountId object
     * @param {string} data Account ID
     */
    unpackAccountId(data) {
        data = atobInt8(data.replace('-', '+').replace('_', '/'))
        const crc = crc16(data.subarray(0, 34))
        if (!bufferViewEqual(crc, data.subarray(34))) {
            throw new Error('Invalid account ID provided, crc16 invalid!')
        }
        let result = {
            _: 'liteServer.accountId',
            flags: data[0]
        }
        if ((result.flags & 0x3f) != 0x11) {
            throw new Error('Invalid account ID, wrong flags')
        }
        result.testnet = result.flags & 0x80
        result.bounceable = !(result.flags & 0x40)
        result.workchain = data[1] > 0x7F ? -(data[1] - 0xFF) : data[1]
        result.id = new Uint32Array(data.slice(2, 34).buffer)

        return result
    }
    /**
     * Deserialize bag of cells
     * @param {Uint8Array} cell Serialized cell data
     */
    slice(cell) {
        if (!cell.byteLength) {
            return {}
        }
        // This should be all done automatically by the TL parser
        console.log(cell)

        let stream = new BitStream(cell.buffer)
        const crc = stream.readBits(32)
        if (crc !== 3052313714) {
            throw new Error(`Invalid BOC constructor ${crc}`)
        }
        let result = {
            _: 'serialized_boc',
            has_idx: stream.readBits(1),
            has_crc32c: stream.readBits(1),
            has_cache_bits: stream.readBits(1),
            flags: stream.readBits(2),
            size: stream.readBits(3),
            off_bytes: stream.readBits(8),
        }
        const size = result.size * 8
        result.cell_count = stream.readBits(size)
        result.roots = stream.readBits(size)
        result.absent = stream.readBits(size)
        result.tot_cells_size = stream.readBits(result.off_bytes * 8)
        result.root_list = stream.readBits(result.roots * size)

        if (result.has_idx) {
            result.index = stream.readBits(result.cell_count * result.off_bytes * 8)
        }
        result.cell_data = stream.readBits(result.tot_cells_size * 8, false)
        if (result.has_crc32c) {
            result.crc32c = stream.readBits(32)
        }

        stream = new BitStream(result.cell_data.buffer)
        result.cellsRaw = []
        result.cells = []
        for (let x = 0; x < result.cell_count; x++) {
            // Will optimize later
            result.cellsRaw.push(this.deserializeCell(stream, size))
            result.cells.push(new BitStream(result.cellsRaw[x].data.buffer))
        }

        for (let x = 0; x < result.cell_count; x++) {
            for (let ref in result.cellsRaw[x].refs) {
                result.cells[x].pushRef(result.cells[ref])
            }
        }
        result.root = result.cells[0]
        return result
    }
    /**
     * Deserialize cell
     * @param {BitStream} stream Bitstream of cells
     * @param {number}    size   Ref size
     */
    deserializeCell(stream, size) {
        // Approximated TL-B schema
        // cell$_ flags:(## 2) level:(## 1) hash:(## 1) exotic:(## 1) absent:(## 1) refCount:(## 2) 
        let result = {}
        result.flags = stream.readBits(2)
        result.level = stream.readBits(1)
        result.hash = stream.readBits(1)
        result.exotic = stream.readBits(1)
        result.absent = stream.readBits(1)
        result.refCount = stream.readBits(2)

        if (result.absent) {
            throw new Error("Can't deserialize absent cell!")
        }
        result.length = stream.readBits(7)
        result.lengthHasBits = stream.readBits(1)
        result.data = stream.readBits((result.length + result.lengthHasBits) * 8)
        if (result.lengthHasBits) {
            let idx = result.data.byteLength - 1
            for (let x = 0; x < 6; x++) {
                if (result.data[idx] & (1 << x)) {
                    result.data[idx] &= ~(1 << x)
                    break
                }
            }
        }

        result.refs = []
        for (let x = 0; x < result.refCount; x++) {
            result.refs.push(stream.readBits(length))
        }

        return result
    }
    /**
     * Connect to all liteservers
     */
    async connect() {
        let promises = [];
        for (const key in this.config['liteservers']) {
            const uri = this.settings['wssProxies'][this.config['liteservers'][key]['ip']]
            const connection = new ADNLConnection(this.getTL(), this.config['liteservers'][key]['id'], uri)
            promises.push(connection.connect().then(() => this.connections.push(connection)))
        }
        await Promise.all(promises)

        // Cache server version
        await this.getVersion()

        console.log(`Server version is ${this.server.version >> 8}.${this.server.version & 0xFF}, capabilities ${this.server.capabilities}`)
        if (!this.server.ok) {
            console.error(`Server version is too old (at least ${this.min_ls_version >>8}.${this.min_ls_version & 0xFF} with capabilities ${this.min_ls_capabilities} required), some queries are unavailable!`)
        }
        console.log(`Server time is ${this.serverTime}`)

        // Get masterchain info
        await this.getMasterchainInfo()
    }
    /**
     * Get masterchain info (equivalent to `last`)
     * @returns {Object} liteServer.masterchainInfoExt or liteServer.masterchainInfo, depending on liteserver version
     */
    last() {
        return this.getMasterchainInfo()
    }
    /**
     * Get masterchain info (equivalent to `last`)
     * @returns {Object} liteServer.masterchainInfoExt or liteServer.masterchainInfo, depending on liteserver version
     */
    async getMasterchainInfo() {
        const mode = (this.server.capabilities[0] & 2) ? 0 : -1;
        const info = await this.methodCall(
            mode < 0 ? 'liteServer.getMasterchainInfo' : 'liteServer.getMasterchainInfoExt', {
                mode,
            }
        )
        this._parseMasterchainInfo(info) // Reduce clutter for abstraction methods

        return info
    }
    /**
     * Request block by ID
     * @param {Object} id Block ID
     */
    async requestBlock(id) {
        const block = await this.methodCall('liteServer.getBlock', {
            id
        })
        if (!deepEqual(block.id, id)) {
            console.error(block, id)
            throw new Error('Got wrong block!')
        }
        //await this._registerMasterchainBlock(block.id, block.data)

        return block
    }
    /**
     * Get server version
     * @returns {Object}
     */
    async getVersion() {
        const server = await this.methodCall('liteServer.getVersion')
        this._setServerVersion(server)
        this._setServerTime(server.now)
        return server
    }
    /**
     * Get server time
     * @returns {Object}
     */
    async getTime() {
        const time = await this.methodCall('liteServer.getTime')
        this._setServerTime(time.now)
        return time
    }



    // Parser functions

    _setServerVersion(server) {
        this.server = server
        this.server.ok = (server.version >= this.min_ls_version) && !(~server.capabilities[0] & this.min_ls_capabilities);
    }
    _setServerTime(time) {
        this.serverTime = time
        this.gotServerTimeAt = Date.now() / 1000 | 0
    }
    _parseMasterchainInfo(info) {
        const last = info.last
        const zero = info.init
        const last_utime = info.last_utime || 0
        if (info['_'] === 'liteServer.masterchainInfoExt') {
            this._setServerVersion(info)
            this._setServerTime(info.now)

            if (last_utime > this.serverTime) {
                console.error("server claims to have a masterchain block", last, `created at ${last_utime} (${last_utime - this.serverTime} seconds in the future)`)
            } else if (last_utime < this.serverTime - 60) {
                console.error("server appears to be out of sync: its newest masterchain block is", last, `created at ${last_utime} (${server_now - last_utime} seconds ago according to the server's clock)`)
            } else if (last_utime < this.gotServerTimeAt - 60) {
                console.error("either the server is out of sync, or the local clock is set incorrectly: the newest masterchain block known to server is", last, `created at ${last_utime} (${server_now - this.gotServerTimeAt} seconds ago according to the local clock)`)
            }
        }

        let myZeroState;
        if (this.zeroState) {
            myZeroState = this.zeroState
        } else {
            myZeroState = this.config.validator.zero_state
            myZeroState._ = 'tonNode.zeroStateIdExt'
            delete myZeroState.shard
            delete myZeroState.seqno
        }

        if (!deepEqual(zero, myZeroState)) {
            console.log(this.config)
            console.error("Zerostate changed: should be", myZeroState, "is", zero)
            throw new Error("Zerostate changed!")
        }
        if (!this.zeroState) {
            this.zeroState = zero
            /*zero._ = 'tonNode.blockIdExt'
            zero.seqno = 0
            zero.shard = [0, -2147483648]*/
            //this._registerBlockId(zero)
            console.log("Zerostate OK!")
        }

        //this._registerBlockId(last)
        if (!this.lastMasterchainId) {
            this.lastMasterchainId = last
            this.requestBlock(last)
        } else if (this.lastMasterchainId.seqno < last.seqno) {
            this.lastMasterchainId = last
        }
        console.log(`Last masterchain block ID known to server is `, last, last_utime ? `created at ${last_utime}` : '')
    }

    // Unused for now
    _registerBlockId(id) {
        for (const block in this.knownBlockIds) {
            if (deepEqual(block, id)) {
                return
            }
        }
        this.knownBlockIds.push(id)
    }
    async _registerMasterchainBlock(id, data) {
        const hash = new Uint32Array(await this.crypto.sha256(data))
        if (!bufferViewEqual(id.file_hash, hash)) {
            console.error(`File hash mismatch for block `, id, `expected ${id.file_hash}, got ${hash}`)
            throw new Error(`File hash mismatch!`)
        }
        //this._registerBlockId(id)
        // Here we should save the block to storage
    }

    /**
     * Call liteserver method
     * @param {string} method Liteserver method name
     * @param {Object} args   Arguments
     */
    methodCall(method, args = {}) {
        args['_'] = method
        args['id'] = args['id'] || this.lastMasterchainId

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