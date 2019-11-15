class Http {
    connect(ctx) {
        this.uri = ctx.getUri('http')
    }
    write(payload) {
        this.xhr = new XMLHttpRequest()
        this.xhr.onload = this.onMessage
        this.xhr.open('POST', this.uri, true)
        this.xhr.responseType = 'arraybuffer'
        this.xhr.send(payload)
    }
}