import Stream from "./stream"

/**
 * Custom TL parser based on an unreleased project of mine (madeline.py).
 * Could've based it on my MadelineProto, but madeline.py's parser is way cleaner.
 */
class Objects {
    byId = {}
    byPredicateAndLayer = {}
    layers = []

    basicSizes = {
        'string': 1,
        'bytes': 1,
        'int': 1,
        '#': 1,
        'long': 2,
        'int128': 4,
        'int256': 8,
        'double': 2,
    }

    /**
     * Init TLObjects
     * @param {Object} schemes JSON scheme object
     */
    constructor(schemes) {
        console.log("Parsing TL schemes")
        let data = [];
        for (let [layer, scheme] of Object.entries(schemes)) {
            // Parse constructors
            for (let key in scheme['constructors']) {
                let constructor = scheme['constructors'][key]
                if ((typeof constructor['layer']) === 'undefined') {
                    constructor['layer'] = layer;
                }
                data.push(constructor);
            }
            // Parse functional constructors (still constructors, store in same array)
            for (let key in scheme['methods']) {
                let method = scheme['methods'][key]
                if ((typeof method['layer']) === 'undefined') {
                    method['layer'] = layer;
                }
                method['predicate'] = method['method'];
                delete method['method'];
                data.push(method);
            }
        }
        for (let constructor of data) {
            let minSize = data['type'] === 'Vector t' ? 1 : 0

            let newParams = {}
            for (let key in constructor['params']) {
                let param = constructor['params'][key]
                
                param['layer'] = constructor['layer'];
                if (param['layer'] === 1 && param['type'] === 'string') {
                    param['type'] = 'bytes'
                }

                if (param['type'][0] === '%') {
                    param = {
                        ...param,
                        ...this.findByType(constructor['type'].substring(1), constructor['layer'])
                    }
                }

                let match = param['type'].match(/^flags\.(\d*)\?(.+)/)
                if (match) {
                    param['pow'] = 2**match[1]
                    param['type'] = match[2]
                }

                match = param['type'].match(/^(vector)<(.*)>$/i)
                if (match) {
                    param['type'] = 'Vector t'
                    param['subtype'] = {
                        type: match[2],
                        layer: param['layer']
                    }
                    // If bare vector type
                    if (match[1] === 'vector') {
                        param['predicate'] = match[1]
                    }
                    if (param['subtype'][0] === '%') {
                        param = {
                            ...param,
                            ...this.findByType(constructor['subtype'].substring(1), constructor['layer'])
                        }
                    }
                }

                if (this.basicSizes[param['type']] && !param['pow']) {
                    minSize += this.basicSizes[param['type']]
                }

                let name = param['name']
                delete param['name']
                newParams[name] = param
            }
            constructor['params'] = newParams
            constructor['minSize'] = minSize

            this.byId[constructor['id']] = constructor
            this.byPredicateAndLayer[constructor['predicate'] + constructor['layer']] = constructor['id']
            if (!this.layers.includes(constructor['layer'])) {
                this.layers.push(constructor['layer'])
            }
        }
        this.layers.sort((a, b) => a < b)
    }

    findById(id) {
        if (!this.byId[id]) {
            throw Error("Could not find object by ID " + id)
        }
        return this.byId[id]
    }
    findByPredicateAndLayer(predicate, layer) {
        let id;
        if (id = this.byPredicateAndLayer[predicate + layer]) {
            return this.byId[id]
        }

        for (layer in this.layers) {
            if (id = this.byPredicateAndLayer[predicate + layer]) {
                return this.byId[id]
            }
        }
        throw Error("Could not find object by predicate " + predicate + " and layer " + layer)
    }

    findByType(type, layer) {
        for (let object of this.byId) {
            object = this.byId[object]
            if (object['type'] === type && object['layer'] === layer) {
                return object
            }
        }
        throw Error('Could not find object by type ' + type)
    }
}
export default Objects
