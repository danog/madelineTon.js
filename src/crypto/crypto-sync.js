import factorize from "../crypto-sync/prime"
import { secureRandom, secureRandomInt } from "../crypto-sync/random"

class CryptoSync {
    factorize(what) {
        return Promise.resolve(factorize(what))
    }
    secureRandom(buffer) {
        return Promise.resolve(secureRandom(buffer))
    }
    secureRandomInt(mod) {
        return Promise.resolve(secureRandomInt(mod))
    }
}
export default CryptoSync