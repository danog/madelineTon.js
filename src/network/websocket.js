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
        } while (byteView[0] === 0xEF || obf2.includes(random[0]) || random[1] === 0)
        random[14] = 0xefefefef

        let reverse = new Uint8Array(byteView.slice().reverse())

        let key = random.slice(2, 10)
        let keyRev = reverse.slice(2 * 4, 10 * 4)

        let iv = random.slice(10, 14)
        let ivRev = reverse.slice(10 * 4, 14 * 4)

        this.encrypt = await this.crypto.getCtr(key, iv)
        this.decrypt = await this.crypto.getCtr(keyRev, ivRev)

        random.set(new Uint32Array(await this.encrypt.process(random)).slice(14, 16), 14)

        await new Promise((resolve, reject) => {
            this.socket = new WebSocket(ctx.getUri('ws'), 'binary')
            this.socket.binaryType = "arraybuffer"
            this.socket.onmessage = async message => {
                message = new Uint8Array(await this.decrypt.process(new Uint8Array(message.data)))
                let length = message[0]
                length = (length >= 0x7f ? message[1] | message[2] << 8 | message[3] << 16 : length) << 2
                console.log(message.length - 1, length)
                this.onMessage(message.slice(-length).buffer)
            }
            this.socket.onopen = resolve
            this.socket.onerror = reject
            this.socket.onclose = this.close.bind(this)
        })

        this.socket.onerror = e => {
            console.log("Websocket error: ", e)
            this.close()
        }

        return this.socket.send(random)
    }

    async write(payload) {
        const length = payload.byteLength >> 2
        if (length >= 0x7f) {
            this.socket.send(await this.encrypt.process(new Uint32Array([(length << 8) & 0x7F])))
        } else {
            this.socket.send(await this.encrypt.process(new Uint8Array([length])))
        }
        this.socket.send(await this.encrypt.process(payload))
    }

    close() {
        console.log("Closing socket!")
        if (this.socket) {
            this.socket.close()
            this.socket = undefined
        }
    }

    isHttp() {
        return false
    }
}

export default Websocket;