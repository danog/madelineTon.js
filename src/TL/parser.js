import Stream from "./stream"
import Objects from './objects'
import {
    fastRandom,
    fastRandomInt,
    secureRandom
} from "../crypto-sync/random"
import {
    gunzipSync
} from "zlib"
import { atobInt32 } from "../tools"
import Long from "../lib/bigint/long"

/**
 * Custom TL parser based on an unreleased project of mine (madeline.py).
 * Could've based it on my MadelineProto, but madeline.py's parser is way cleaner.
 */
class Parser {
    /**
     * Set TL Object store
     * @param {Objects} objects 
     */
    constructor(objects) {
        this.objects = objects
    }
    /**
     * Set TL Object store
     * @param {Objects} objects 
     */
    setObjectStore(objects) {
        this.objects = objects
    }

    /**
     * Deserialize TL object
     * @param {Stream} data Data
     * @param {Object} type Type info
     */
    deserialize(data, type) {
        type = type || {
            type: ''
        }
        switch (type['type']) {
            case 'int':
                return data.readSignedInt()
            case '#':
                return data.readUnsignedInt()
            case 'long':
                return data.readSignedLong()
            case 'int128':
                return data.readUnsignedInts(4)
            case 'int256':
                return data.readUnsignedInts(8)
            case 'int512':
                return data.readUnsignedInts(8)
            case 'double':
                return data.readDouble()
            case 'Bool':
                return data.readSignedInt() === 0x997275b5
            case 'string':
                return data.readString()
            case 'bytes':
                return data.readBytes()
        }
        if (!type['predicate']) {
            type = {
                ...type,
                ...this.objects.findById(data.readSignedInt())
            }
        }
        switch (type['predicate']) {
            case 'gzip_packed':
                return this.deserialize(gunzipSync(data.readBytes()), {
                    layer: type['layer']
                })
            case 'dataJSON':
                return JSON.parse(data.readString())
            case 'vector':
                const length = data.readUnsignedInt()
                let result = Array(length)
                for (let x = 0; x < length; x++) {
                    result[x] = this.deserialize(data, type['subtype'])
                }
                return result
        }
        const result = {
            _: type['predicate']
        }
        for (let key in type['params']) {
            let param = type['params'][key]
            if (param['pow']) {
                if (param['type'] === 'true') {
                    result[key] = Boolean(result['flags'] & param['pow'])
                    continue
                }
                if (!(result['flags'] & param['pow'])) {
                    continue
                }
            }
            result[key] = this.deserialize(data, param)
        }
        // Later should delete unused flags
        return result
    }
    /**
     * Serialize TL
     * @param {Stream} stream Stream
     * @param {mixed}  data   Data to serialize
     * @param {Object} type   TL type definition
     */
    serialize(stream, data, type) {
        type = type || {}

        switch (type['type']) {
            case 'int':
                return stream.writeSignedInt(data)
            case "#":
                return stream.writeUnsignedInt(data)
            case 'long':
                if (typeof data === 'string' || data instanceof String) {
                    data = Long.fromString(data, 10)
                    data = [data.low_, data.high_]
                }
                return stream.writeSignedLong(data)
            case 'int128':
                if (typeof data === 'string' || data instanceof String) {
                    data = atobInt32(data)
                }
                return stream.writeUnsignedInts(data)
            case 'int256':
                if (typeof data === 'string' || data instanceof String) {
                    data = atobInt32(data)
                }
                return stream.writeUnsignedInts(data)
            case 'int512':
                if (typeof data === 'string' || data instanceof String) {
                    data = atobInt32(data)
                }
                return stream.writeUnsignedInts(data)
            case 'double':
                return stream.writeDouble(data)
            case 'Bool':
                return stream.writeSignedInt(data ? 0x997275b5 : 0xbc799737)
            case 'string':
                return stream.writeString(data)
            case 'bytes':
                return stream.writeBytes(data)
            case 'DataJSON':
                data = {
                    _: 'dataJSON',
                    data: JSON.stringify(data)
                }
        }
        if (!type['predicate']) {
            if (type['type'] === 'Vector t') {
                type = {
                    ...type,
                    ...this.objects.findByPredicateAndLayer('vector', type['layer'])
                }
            } else {
                type = {
                    ...type,
                    ...this.objects.findByPredicateAndLayer(data['_'] || data['@type'], type['layer'])
                }
            }
            stream.prepareLength(1 + type['minSize']).writeSignedInt(type['id'])
        } else {
            stream.prepareLength(type['minSize'])
        }
        if (type['predicate'] === 'vector') {
            stream.writeUnsignedInt(data.length)
            if (this.objects.basicSizes[type['subtype']]) {
                stream.prepareLength(data.length * this.objects.basicSizes[type['subtype']])
            }
            for (let element in data) {
                this.serialize(stream, data[element], type['subtype'])
            }
            return
        }

        let flagSize = 0
        for (let key in type['params']) {
            let param = type['params'][key]
            if (param['pow']) {
                let flags = data[param['flag']] || 0

                if (!data[key]) {
                    flags = flags & ~param['pow']
                } else {
                    flags = flags | param['pow']

                    flagSize += this.objects.basicSizes[param['type']] || 0
                }

                data[param['flag']] = flags
            }
        }
        stream.prepareLength(flagSize)

        for (let key in type['params']) {
            let param = type['params'][key]

            if (typeof data[key] === 'undefined') {
                if (param['pow']) {
                    continue
                }
                if (key === 'random_bytes') {
                    // This should run in a worker
                    stream.writeBytes(secureRandom(new Uint8Array(15 + 4 * fastRandomInt(3))))
                    continue
                }
                if (key === 'random_id') {
                    switch (param['type']) {
                        case 'long':
                            stream.writeUnsignedInts(fastRandom(new Uint32Array(2)))
                            break
                        case 'int':
                            stream.writeUnsignedInts(fastRandom(new Uint32Array(1)))
                            break
                        case 'Vector t':
                            if (data['id']) {
                                const len = data['id'].length // forwardMessages
                                if (!param['predicate']) {
                                    stream.prepareLength(1).writeSignedInt(this.objects.findByPredicateAndLayer('vector', type['layer'])['id'])
                                }
                                stream.prepareLength(1 + len * 2).writeUnsignedInt(len).writeUnsignedInts(fastRandom(new Uint32Array(len * 2)))
                                break
                            }
                            // Fall through
                            default:
                                throw new Error('Missing parameter ' + key)
                    }
                    continue
                }
                if (param['type'] === 'string' || param['type'] === 'bytes') {
                    stream.writeBytes(new Uint8Array(0))
                    continue
                }
                if (param['type'] === 'Vector t') {
                    if (!param['predicate']) {
                        stream.prepareLength(1).writeSignedInt(this.objects.findByPredicateAndLayer('vector', type['layer'])['id'])
                    }
                    stream.prepareLength(1).writeUnsignedInt(0)
                    continue
                }
                if (key === 'hash' && param['type'] === 'int') {
                    stream.writeSignedInt(0)
                    continue
                }
                if (type['type'] === 'DocumentAttribute' && ['w', 'h', 'duration'].includes(key)) {
                    stream.writeSignedInt(0)
                    continue
                }
                try {
                    let id = this.objects.findByPredicateAndLayer('input' + param['type'] + "Empty", param['layer'])
                    if (id['type'] === param['type']) {
                        stream.writeSignedInt(id['id'])
                        continue
                    }
                } catch (e) {}
                let paramType = param['type']
                paramType = paramType[0].toLowerCase().concat(paramType.slice(1))
                try {
                    let id = this.objects.findByPredicateAndLayer(paramType + "Empty", param['layer'])
                    if (id['type'] === param['type']) {
                        stream.writeSignedInt(id['id'])
                        continue
                    }
                } catch (e) {}
                throw new Error('Missing parameter ' + key)
            }
            this.serialize(stream, data[key], param)
        }
        return stream
    }
}
export default Parser