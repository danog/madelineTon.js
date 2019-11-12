import factorize from '../crypto-sync/prime'
import {
    secureRandom,
    secureRandomInt
} from '../crypto-sync/random'

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
        case 'seed':
            rng_seed_time()
            break
    }
    postMessage({
        result,
        id: message['id']
    })
}