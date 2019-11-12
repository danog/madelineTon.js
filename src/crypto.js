if (window.msCrypto) {
    useWebCryptoSha1 = false
}
if (window.crypto.webkitSubtle) {
    window.crypto.subtle = window.crypto.webkitSubtle
}

window.ponyDigest = window.crypto.digest
if (window.msCrypto) {
    window.ponyDigest = (algo, data) => {
        if (algo !== 'SHA-1') {
            return window.crypto.digest(algo, data)
        }

    }
}
