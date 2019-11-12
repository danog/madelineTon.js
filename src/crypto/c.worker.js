import factorize from '../crypto-sync/prime'
import {
    secureRandom,
    secureRandomInt
} from '../crypto-sync/random'
import {
    sha256,
    sha1,
    igeEncrypt,
    igeDecrypt
} from '../crypto-sync/crypto'

onmessage = message => {
    let result
    switch (message['task']) {
        case 'factorize':
            result = factorize(message['task'])
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
        case 'seed':
            rng_seed_time()
            break
    }
    postMessage({
        result,
        id: message['id']
    })
}