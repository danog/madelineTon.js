import Stream from "../TL/stream"
import {
    bufferConcat,
    bufferViewEqual
} from "../tools"
import {
    fastRandom
} from "../crypto-sync/random"

class ADNL {
    allRead = 0 // Data read thus far (from all active buffers)
    toRead = 4
    buffers = [] // All incoming messages buffered separately to avoid the overhead of concat
    decryptedBuffers = [] // Decrypted buffers
    offset = 0
    bufferOffset = 0
    isRunning = false
    /**
     * 
     * @param {Object} ctx Custom connection context
     */
    async connect(ctx) {
        this.crypto = ctx.crypto

        this.encrypt = await this.crypto.getCtr(...ctx.encrypt)
        this.decrypt = await this.crypto.getCtr(...ctx.decrypt)

        await new Promise((resolve, reject) => {
            this.socket = new WebSocket(ctx.uri, 'binary')
            this.socket.binaryType = "arraybuffer"
            this.socket.onmessage = message => {
                message = message.data
                //console.log("Got payload with length " + message.byteLength)
                this.allRead += message.byteLength
                this.buffers.push(message)

                //console.log(this.allRead, this.toRead)
                // Here we have the nasty detail that a protocol-unaware websocket proxy might send out unproperly framed data
                // All websocket proxies in this case are protocol-unaware, since MITM is NOT possible due to ECC
                if (this.allRead >= this.toRead) {
                    this.gotBuffer()
                }
            };
            this.socket.onopen = resolve
            this.socket.onerror = reject
            this.socket.onclose = this.close.bind(this)
        })

        this.socket.onerror = e => {
            console.log("Websocket error: ", e)
            this.close()
        }

        return this.socket.send(ctx.init)
    }

    /**
     * Called when enough data is buffered
     */
    gotBuffer() {
        // Decrypt new buffers
        let promises = []
        // Doing decryption like this instead of decrypting as each block arrives to avoid starting processing of buffer if some middle chunk hasn't been decrypted yet
        this.buffers.forEach((value, index) => {
            delete this.buffers[index]
            promises.push(this.decrypt.process(new Uint8Array(value)).then(result => {
                this.decryptedBuffers[index] = new Uint8Array(result)
            }));
        });
        Promise.all(promises).then(() => {
            if (!this.isRunning) {
                this.process()
            }
        })
    }

    /**
     * Read N bytes from the decrypted buffer(s)
     */
    read(length) {
        const left = this.decryptedBuffers[this.bufferOffset].byteLength - this.offset
        if (left > length) {
            const buffer = this.decryptedBuffers[this.bufferOffset].slice(this.offset, this.offset + length)
            this.offset += length

            return buffer.buffer;
        }
        if (left === length) {
            let buffer = this.decryptedBuffers[this.bufferOffset]
            if (this.offset) {
                buffer = buffer.slice(this.offset)
            }
            delete this.decryptedBuffers[this.bufferOffset++]
            this.offset = 0
            return buffer.buffer
        }
        let buffer = this.decryptedBuffers[this.bufferOffset]
        if (this.offset) {
            buffer = buffer.slice(this.offset)
        }
        delete this.decryptedBuffers[this.bufferOffset++]
        this.offset = 0

        return bufferConcat(buffer, this.read(length - buffer.byteLength)).buffer
    }

    async process() {
        this.isRunning = true

        if (this.toRead === 4) { // Read length and possibly more
            this.allRead -= this.toRead
            this.toRead = (new Uint32Array(this.read(this.toRead)))[0] // Forget about exotic endiannesses for now

            if (this.allRead < this.toRead) {
                console.log(`Not enough data to read, suspending (need ${this.toRead}, have ${this.allRead})`)
                return
            }
        }

        const message = new Uint32Array(this.read(this.toRead - 32))
        const sha = new Uint32Array(await this.crypto.sha256(message))

        if (!bufferViewEqual(sha, new Uint32Array(this.read(32)))) {
            throw new Error('SHA256 mismatch!');
        }

        if (message.length === 8) {
            console.log("OK, got empty message!")
        } else {
            this.onMessage(new Stream(message.slice(8).buffer))
        }

        this.allRead -= this.toRead
        this.toRead = 4

        if (this.allRead >= this.toRead) {
            this.process()
        }
        this.isRunning = false
    }
    async write(payload) {
        payload.pos = 0
        payload.writeUnsignedInt(payload.bBuf.length - 4)
        payload.writeUnsignedInts(fastRandom(new Uint32Array(8)))
        payload.pos = payload.uBuf.length - 8
        payload.writeUnsignedInts(new Uint32Array(await this.crypto.sha256(payload.uBuf.slice(1, payload.pos))))

        payload = payload.bBuf

        return this.encrypt.process(payload).then(payload => this.socket.send(payload))
    }
    getBuffer(length) {
        const s = new Stream(new Uint32Array(17 + (length || 0)))
        s.pos += 9
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

export default ADNL;