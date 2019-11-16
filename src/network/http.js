import Stream from "../TL/stream"

class Http {
    connect(ctx) {
        this.uri = ctx.getUri('http')
    }
    async write(payload) {
        let xhr = new XMLHttpRequest()
        xhr.onload = this.onHttpMessage.bind({
            xhr,
            onMessage: this.onMessage
        })
        xhr.open('POST', this.uri, true)
        xhr.responseType = 'arraybuffer'
        xhr.send(payload)
    }
    onHttpMessage() {
        if (this.xhr.status === 200) {
            return this.onMessage(new Stream(this.xhr.response))
        }
        this.onMessage(new Stream(new Uint32Array(1).buffer).writeSignedInt(-this.xhr.status).reset())
    }
    isHttp() {
        return true
    }
    close() {

    }
}
export default Http;