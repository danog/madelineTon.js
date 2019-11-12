
console.log(window)
if (typeof window === 'undefined') {
    var window = {}
}
if (window.msCrypto) {
    window.crypto = window.msCrypto
}
if (window.crypto && window.crypto.webkitSubtle) {
    window.crypto.subtle = window.crypto.webkitSubtle
}
let useWebCrypto = !!window.crypto
let useWebCryptoRandom = useWebCrypto && !!window.crypto.getRandomValues
let useWebCryptoSha1 = useWebCrypto && !window.msCrypto
let useWorkers = !!window.Worker
let isWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope

let prefix = isWorker ? "Worker: " : ""
if (useWebCrypto) {
    console.log(prefix+"Using WebCrypto")
} else {
    console.log(prefix+"Using cryptoJS")
}
if (useWebCryptoRandom) {
    console.log(prefix+"Using WebCrypto random")
} else {
    console.log(prefix+"Using prng random")
}
if (useWebCryptoSha1) {
    console.log(prefix+"Using WebCrypto SHA1")
} else {
    console.log(prefix+"Using JS SHA1")
}
if (useWorkers) {
    console.log(prefix+"Using workers")
} else {
    console.log(prefix+"Not using workers")
}
export {
    useWebCrypto,
    useWebCryptoRandom,
    useWebCryptoSha1,
    useWorkers
}