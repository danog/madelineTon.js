class Http {
    connect(ctx) {
        this.uri = ctx.getUri('http')
    }
    write(payload) {
        let xhr = new XMLHttpRequest()
        xhr.onload = this.onMessage.bind(this)
        xhr.open('POST', this.uri, true)
        xhr.responseType = 'arraybuffer'
        xhr.send(payload)
    }
    isHttp() {
        return true
    }
    close() {

    }
}