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
        random[15] = 0xefefefef
        let reverse = new Uint32Array(byteView.reverse().buffer)

        let key = random.subarray(2, 6)
        let keyRev = reverse.subarray(2, 6)

        let iv = random.subarray(10, 16)
        let ivRev = random.subarray(10, 16)

        this.encrypt = await this.crypto.getCtr(key, iv)
        this.decrypt = await this.crypto.getCtr(keyRev, ivRev)

        random.set(await this.encrypt.process(random.subarray(14, 16)), 14)

        await new Promise((resolve, reject) => {
            this.socket = new WebSocket(ctx.getUri('ws'))
            this.socket.binaryType = "arraybuffer"
            this.socket.onmessage = message => {
                message = new Uint8Array(this.decrypt.process(message.data))
                let length = message[0]
                length = (length >= 0x7f ? length : message[1] | message[2] << 8 | message[3] << 16) >> 2
                this.onMessage(message.subarray(length >= 0x7f ? 4 : 1).buffer)
                //this.onMessage()
            }
            this.socket.onopen = resolve
            this.socket.onerror = reject
        })
        this.socket.onerror = e => {
            console.log("Websocket error: ", e)
            this.close()
        }

        return this.socket.send(random)
    }

    write(payload) {
        const length = payload.byteLength << 2
        if (length >= 0x7f) {
            this.socket.send(new Uint32Array((length << 8) & 0x7F))
        } else {
            this.socket.send(new Uint8Array(length))
        }
        await this.socket.send(payload)
    }

    close() {
        if (this.socket) {
            this.socket.close()
            this.socket = undefined
        }
    }
}

export default Websocket;