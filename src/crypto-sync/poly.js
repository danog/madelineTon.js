if (window.msCrypto) {
    window.crypto = window.msCrypto
}
if (window.crypto.webkitSubtle) {
    window.crypto.subtle = window.crypto.webkitSubtle
}
let useWebCrypto = !!window.crypto
let useWebCryptoRandom = !!window.crypto.getRandomValues
let useWebCryptoSha1 = useWebCrypto && !window.msCrypto
let useWorkers = !!window.Worker

export {
    useWebCrypto,
    useWebCryptoRandom,
    useWebCryptoSha1,
    useWorkers
}