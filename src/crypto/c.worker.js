import factorize from '../crypto-sync/prime'
import {
    secureRandom,
    secureRandomInt
} from '../crypto-sync/random'
import {
    sha256,
    sha1,
    igeEncrypt,
    igeDecrypt,
    CtrProcessor
} from '../crypto-sync/crypto'
import {
    checkAll
} from '../crypto-sync/math'
import { powMod } from 'leemon'

let ctrWorkers = []
onmessage = message => {
    message = message['data']
    let result
    try {
        switch (message['task']) {
            case 'factorize':
                result = factorize(message['what'])
                break
            case 'secureRandom':
                result = secureRandom(message['buffer'])
                break
            case 'secureRandomInt':
                result = secureRandomInt(message['mod'])
                break
            case 'sha1':
                result = sha1(message['buffer'])
                break
            case 'sha256':
                result = sha256(message['buffer'])
                break
            case 'igeEncrypt':
                result = igeEncrypt(message['data'], message['key'], message['iv'])
                break
            case 'igeDecrypt':
                result = igeDecrypt(message['data'], message['key'], message['iv'])
                break
            case 'ctrInit':
                result = ctrWorkers.length
                ctrWorkers.push(new CtrProcessor(message['key'], message['iv']))
                break
            case 'ctrClose':
                if (typeof ctrWorkers[message['ctrId']] !== 'undefined') {
                    ctrWorkers[message['ctrId']].close()
                    delete ctrWorkers[message['ctrId']]
                }
                break
            case 'ctr':
                result = ctrWorkers[message['ctrId']].process(message['data'])
                break
            case 'seed':
                rng_seed_time()
                break
            case 'powMod':
                result = powMod(message['b'], message['e'], message['n'])
                break
            case 'checkAll':
                result = checkAll(message['p'], message['g'], message['G_'])
                break
        }
    } catch (e) {
        return postMessage({
            e,
            id: message['id']
        })
    }
    postMessage({
        result,
        id: message['id']
    })
}