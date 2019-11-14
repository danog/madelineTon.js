class Context
{
    secure = false
    secure(secure) {
        this.secure = secure
        return this
    }
    isSecure() {
        return this.secure
    }
    setUri(host, port) {
        this.host = host
        this.port = port
        return this
    }
    getUri(prefix) {
        return `${prefix}${this.secure ? 's' : ''}://${this.host}:${this.port}`
    }
    setCrypto(crypto) {
        this.crypto = crypto
    }
    getCrypto() {
        return this.crypto
    }
}
export default Context