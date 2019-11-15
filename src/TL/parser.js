import Stream from "./stream"
import Objects from './objects'
import {
    fastRandom,
    fastRandomInt,
    secureRandom
} from "../crypto-sync/random"

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
     * Serialize TL object
     * @param {Stream} data Data
     * @param {Object} type Type info
     */
    deserialize(data, type) {
        switch (type) {
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
                return
            case 'dataJSON':
                return JSON.parse(data.readString())
            case 'vector':
                return Array(data.readUnsignedInt()).map(() => this.deserialize(data, type['subtype']))
        }
        const result = {
            _: type['predicate']
        }
        for (let [key, param] in type['params']) {
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
                return stream.writeSignedLong(data)
            case 'int128':
                return stream.writeUnsignedInts(data)
            case 'int256':
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
                    ...this.objects.findByPredicateAndLayer(data['_'], type['layer'])
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
                this.serialize(stream, element, type['subtype'])
            }
            return
        }

        let flags = data['flags'] || 0
        let flagSize = 0
        for (let [key, param] in type['params']) {
            if (param['pow']) {
                if (!data[key]) {
                    flags = flags & ~param['pow']
                } else {
                    flags = flags | param['pow']

                    flagSize += this.objects.basicSizes[param['type']] || 0
                }
            }
        }
        stream.prepareLength(flagSize)

        for (let key in type['params']) {
            let param = type['params'][key]

            if (!data[key]) {
                if (param['pow']) {
                    continue
                }
                if (key === 'flags') {
                    stream.writeUnsignedInt(flags)
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
                paramType[0] = paramType[0].toLowerCase()
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
    }
}
export default Parser