import {
    fastRandom
} from "../crypto-sync/random"
import {
    obf2
} from "../TL/constants"

class Websocket {
    /**
     * 
     * @param {Context} ctx Connection context
     */
    async connect(ctx) {
        this.crypto = ctx.getCrypto()

        let random = new Uint32Array(16)
        let byteView = new Uint8Array(random.buffer)
        do {
            fastRandom(random)
        } while (firstByte === 0xEF || obf2.includes(random[0]) || random[1] === 0)
        random[15] = 0xdddddddd
        let reverse = new Uint32Array(byteView.reverse().buffer)

        let key = random.subarray(2, 6)
        let keyRev = reverse.subarray(2, 6)

        let iv = random.subarray(10, 16)
        let ivRev = random.subarray(10, 16)

        this.encrypt = await this.crypto.getCtr(key, iv)
        this.decrypt = await this.crypto.getCtr(keyRev, ivRev)

        random.set(await this.encrypt.process(random.subarray(14, 16)), 14)

        this.socket = new WebSocket(ctx.getUri('ws'))
        this.socket.binaryType = "arraybuffer"
        this.socket.onmessage = this.onMessage.bind(this)
        await new Promise((resolve, reject) => {
            this.socket.onopen = resolve
            this.socket.onerror = reject
        })
        this.socket.onerror = this.onError.bind(this)

        return this.socket.send(random)
    }
    onError(e) {
        console.log("Websocket error: ", e)
        this.close()
    }

    onMessage(message) {
        message = this.decrypt.process(message.data)
    }
    close() {
        if (this.socket) {
            this.socket.close()
            this.socket = undefined
        }
    }
}

export default Websocket;