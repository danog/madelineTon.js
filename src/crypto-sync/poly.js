let windowObject = {}
if (typeof window !== 'undefined') {
    windowObject = window
} else if (typeof crypto !== 'undefined') {
    windowObject = {
        crypto: crypto
    }
}

if (windowObject.msCrypto) {
    windowObject.crypto = windowObject.msCrypto
}
if (windowObject.crypto && windowObject.crypto.webkitSubtle) {
    windowObject.crypto.subtle = windowObject.crypto.webkitSubtle
}
let useWebCrypto = !!windowObject.crypto
let useWebCryptoRandom = useWebCrypto && !!windowObject.crypto.getRandomValues
let useWebCryptoSha1 = useWebCrypto && !windowObject.msCrypto
let useWorkers = !!windowObject.Worker
let isWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope

let prefix = isWorker ? "Worker: " : ""
let worker = useWorkers ? "+worker " : ""
if (useWebCrypto) {
    console.log(prefix + "Using cryptoJS IGE" + worker)
    console.log(prefix + "Using WebCrypto CTR")
    console.log(prefix + "Using WebCrypto SHA256")
} else {
    console.log(prefix + "Using cryptoJS IGE" + worker)
    console.log(prefix + "Using cryptoJS CTR" + worker)
    console.log(prefix + "Using cryptoJS SHA256" + worker)
}
if (useWebCryptoSha1) {
    console.log(prefix + "Using WebCrypto SHA1")
} else {
    console.log(prefix + "Using JS SHA1" + worker)
}
if (useWebCryptoRandom) {
    console.log(prefix + "Using WebCrypto random")
} else {
    console.log(prefix + "Using prng random" + worker)
}
if (useWorkers) {
    console.log(prefix + "Using workers")
} else {
    console.log(prefix + "Not using workers")
}
export {
    useWebCrypto,
    useWebCryptoRandom,
    useWebCryptoSha1,
    useWorkers,
    windowObject
}