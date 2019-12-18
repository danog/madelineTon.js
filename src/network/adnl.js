import Stream from "../TL/stream"
import {
    bufferConcat,
    bufferViewEqual
} from "../tools"

class ADNL {
    allRead = 0 // Data read thus far (from all active buffers)
    buffers = [] // All incoming messages buffered separately to avoid the overhead of concat
    decryptedBuffers = [] // Decrypted buffers
    offset = 0
    bufferOffset = 0
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
                this.allRead += message.byteLength
                this.buffers.push(message)
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
        // Doing decryption like this instead of decrypting as each block arrives to avoid starting processing of buffer if some middle chunk is missing
        for (let idx of this.buffers) {
            this.promises.push(this.decrypt.process(new Uint8Array(this.buffers[idx])).then(result => {
                this.decryptedBuffers[idx] = new Uint8Array(result)
                delete this.buffers[idx]
            }));
        }
        Promise.all(promises).then(() => this.process())
    }

    /**
     * Read N bytes from the decrypted buffer(s)
     */
    read(length) {
        if (this.decryptedBuffers[this.bufferOffset].byteLength - this.offset > length) {
            const buffer = this.decryptedBuffers[this.bufferOffset].slice(this.offset, this.offset + length)
            this.offset += length

            this.decryptedBuffers[this.bufferOffset] = this.decryptedBuffers[this.bufferOffset].subarray(this.offset)
            return buffer.buffer;
        }
        if (this.decryptedBuffers[this.bufferOffset].byteLength - this.offset === length) {
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

    process() {
        if (this.toRead === 4) { // Read length and possibly more
            this.allRead -= this.toRead
            this.toRead = (new Uint32Array(this.read(this.toRead)))[0] // Forget about exotic endiannesses for now

            if (this.allRead < this.toRead) {
                return
            }
        }

        const message = new Uint32Array(this.read(this.toRead - 8))
        const sha = new Uint32Array(await this.crypto.sha256(message))

        if (!bufferViewEqual(sha, new Uint32Array(this.read(8)))) {
            throw new Error('SHA256 mismatch!');
        }

        this.onMessage(new Stream(message.slice(8).buffer))

        this.allRead -= this.toRead
        this.toRead = 4
        if (this.allRead >= this.toRead) {
            this.process()
        }
    }
    async write(payload) {
        payload.pos = 0
        payload.writeUnsignedInt(payload.uBuf.length - 1)
        payload.pos = payload.uBuf.length - 8
        payload.writeUnsignedInts(await this.crypto.sha256(payload.uBuf.slice(1, payload.pos)))
        
        payload = payload.bBuf

        return this.encrypt.process(payload).then(payload => this.socket.send(payload))
    }
    getBuffer(length) {
        const s = new Stream(new Uint32Array(17 + (length || 0)))
        s.pos += 17
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