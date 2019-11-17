import {
    fastRandom
} from "../crypto-sync/random"
import {
    obf2
} from "../TL/constants"
import Stream from "../TL/stream"
import {
    transfer
} from "../tools"

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

        let reverse = new Uint32Array(byteView.slice().reverse().buffer)

        let key = random.slice(2, 10)
        let keyRev = reverse.slice(2, 10)

        let iv = random.slice(10, 14)
        let ivRev = reverse.slice(10, 14)

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
                //console.log(message.length - 1, length)
                this.onMessage(new Stream(message.slice(-length).buffer))
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

    write(payload) {
        const length = payload.uBuf.length - 1
        if (length >= 0x7f) {
            payload.pos = 0
            payload.writeUnsignedInt((length << 8) & 0x7F)
            payload = payload.bBuf
        } else {
            payload = payload.bBuf.slice(3)
            payload[0] = length
        }

        return this.encrypt.process(payload).then(payload => this.socket.send(payload))
    }
    getBuffer(length) {
        const s = new Stream(new Uint32Array(6 + (length || 0)))
        s.pos += 6
        s.initPos = 1
        return s
    }

    close() {
        console.log("Closing socket!")
        if (this.socket) {
            this.socket.close()
            this.socket = undefined
            this.onClose()
        }
    }

    isHttp() {
        return false
    }
}

export default Websocket;