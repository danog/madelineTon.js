class Context
{
    _secure = true
    secure(secure) {
        this._secure = secure
        return this
    }
    isSecure() {
        return this._secure
    }
    setDcId(id) {
        this.dc = id
        return this
    }
    getDcId() {
        return this.dc
    }
    setUri(host, port) {
        this.host = host
        this.port = port
        return this
    }
    getUri(prefix) {
        let uri = prefix === 'ws' ? prefix : 'w1'
        return `${prefix}${this._secure ? 's' : ''}://${this.host}:${this.port}/api${uri}`
    }
    setCrypto(crypto) {
        this.crypto = crypto
        return this
    }
    getCrypto() {
        return this.crypto
    }
}
export default Context