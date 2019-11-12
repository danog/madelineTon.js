import {
    useWebCrypto,
    useSha1,
    useWorkers
} from '../crypto-sync/poly'
import CryptoWorker from './crypto-worker'
import CryptoSync from './crypto-sync'
import CryptoWebCrypto from './crypto-webcrypto'

let Crypto = useWorkers ? CryptoWorker : CryptoSync
if (useWebCrypto) {
    if (useSha1) {
        Crypto.prototype.sha1 = CryptoWebCrypto.prototype.sha1
    }
    Crypto.prototype.sha256 = CryptoWebCrypto.prototype.sha256
    Crypto.prototype.getCtr = CryptoWebCrypto.prototype.getCtr
}

export default Crypto