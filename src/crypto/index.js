import {
    useWebCrypto,
    useWebCryptoSha1,
    useWorkers
} from '../crypto-sync/poly'
import CryptoWorker from './crypto-worker'
import CryptoSync from './crypto-sync'
import CryptoWebCrypto from './crypto-webcrypto'

let CryptoAsync = useWorkers ? CryptoWorker : CryptoSync
if (useWebCrypto) {
    if (useWebCryptoSha1) {
        CryptoAsync.prototype.sha1 = CryptoWebCrypto.prototype.sha1
    }
    CryptoAsync.prototype.sha256 = CryptoWebCrypto.prototype.sha256
    CryptoAsync.prototype.getCtr = CryptoWebCrypto.prototype.getCtr
}

export default CryptoAsync
