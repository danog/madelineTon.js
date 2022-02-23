import {
    useWebCrypto,
    useWebCryptoSha1,
    useWorkers
} from '../crypto-sync/poly'
import CryptoWorker from './crypto-worker'
import CryptoSync from './crypto-sync'
import CryptoWebCrypto from './crypto-webcrypto'
import {
    bufferConcat
} from '../tools'

let CryptoAsync = useWorkers ? CryptoWorker : CryptoSync
if (useWebCrypto) {
    if (useWebCryptoSha1) {
        CryptoAsync.prototype.sha1 = CryptoWebCrypto.prototype.sha1
    }
    CryptoAsync.prototype.sha256 = CryptoWebCrypto.prototype.sha256
    CryptoAsync.prototype.igeEncrypt = CryptoWebCrypto.prototype.igeEncrypt
    CryptoAsync.prototype.getCtr = CryptoWebCrypto.prototype.getCtr
}
CryptoAsync.prototype.aesCalculate = async function (msgKey, authKey, toServer = true) {
    toServer = toServer ? 0 : 8
    let sha256_a = new Uint8Array(await this.sha256(bufferConcat(msgKey, authKey.subarray(toServer, toServer + 36))))
    let sha256_b = new Uint8Array(await this.sha256(bufferConcat(authKey.subarray(40 + toServer, 76 + toServer), msgKey)))
    let aesKey = bufferConcat(sha256_a.subarray(0, 8), sha256_b.subarray(8, 24), sha256_a.subarray(24, 32))
    let aesIv = bufferConcat(sha256_b.subarray(0, 8), sha256_a.subarray(8, 24), sha256_b.subarray(24, 32))

    return [aesKey, aesIv]
}
CryptoAsync.prototype.oldAesCalculate = async function (msgKey, authKey, toServer = true) {
    toServer = toServer ? 0 : 8
    let sha1_a = new Uint8Array(await this.sha1(bufferConcat(msgKey, authKey.subarray(toServer, toServer + 32))))
    let sha1_b = new Uint8Array(await this.sha1(bufferConcat(authKey.subarray(32 + toServer, 48 + toServer), msgKey, authKey.subarray(48 + toServer, 64 + toServer))))
    let sha1_c = new Uint8Array(await this.sha1(bufferConcat(authKey.subarray(64 + toServer, 96 + toServer), msgKey)))
    let sha1_d = new Uint8Array(await this.sha1(bufferConcat(msgKey, authKey.subarray(96 + toServer, 128 + toServer))))

    let aesKey = bufferConcat(sha1_a.subarray(0, 8), bufferConcat(sha1_b.subarray(8, 20), sha1_c.subarray(4, 16)))
    let aesIv = bufferConcat(sha1_a.subarray(8, 20), bufferConcat(sha1_b.subarray(0, 8), sha1_c.subarray(16, 20)))

    aesIv = bufferConcat(aesIv, sha1_d.subarray(0, 8))

    return [aesKey, aesIv]
}


export default CryptoAsync