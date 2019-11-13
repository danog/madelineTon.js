import {
    useWebCryptoRandom
} from "../crypto-sync/poly";
import CWorker from './c.worker'

class CryptoWorker {
    constructor(timeout) {
        this.tasks = []
        this.timeout = timeout || 2000 // Change later

        this.worker = new CWorker()
        this.worker.onmessage = this.onMessage.bind(this)

        if (!useWebCryptoRandom && typeof window !== 'undefined') {
            window.onkeydown = window.onclick = () => this.worker.postMessage({
                task: 'seed'
            })
        }
    }
    onMessage(message) {
        message = message['data']
        if (this.tasks[message['id']]) {
            this.tasks[message['id']](message['result'])
        }
    }
    asyncTask(params) {
        params['id'] = this.tasks.length
        return new Promise((resolve, reject) => {
            this.tasks.push(resolve)
            setTimeout(reject, this.timeout, params['id'])
            this.worker.postMessage(params)
        })
    }
    /**
     * Factorize semiprime
     * @param {Uint8Array} what Number to factorize
     * @returns Uint8Array[]
     */
    factorize(what) {
        return this.asyncTask({
            task: 'factorize',
            what
        })
    }
    /**
     * Fill buffer with secure random values
     * @param {BufferSource} buffer Buffer to fill
     */
    secureRandom(buffer) {
        return this.asyncTask({
            task: 'secureRandom',
            buffer
        })
    }
    /**
     * Get secure random number modulo modulus
     * @param {number} mod Modulus
     */
    secureRandomInt(mod) {
        return this.asyncTask({
            task: 'secureRandomInt',
            mod
        })
    }
    /**
     * SHA1
     * @param {Uint32Array} data Data to hash
     * @returns Uint32Array
     */
    sha1(buffer) {
        return this.asyncTask({
            task: 'sha1',
            buffer
        })
    }
    /**
     * SHA256
     * @param {Uint32Array} data Data to hash
     * @returns Uint32Array
     */
    sha256(buffer) {
        return this.asyncTask({
            task: 'sha256',
            buffer
        })
    }
    /**
     * Encrypt data using AES IGE
     * @param {Uint32Array} data Data
     * @param {Uint32Array} key  Key
     * @param {Uint32Array} iv   IV
     */
    igeEncrypt(data, key, iv) {
        return this.asyncTask({
            task: 'igeEncrypt',
            data,
            key,
            iv
        })
    }
    /**
     * Decrypt data using AES IGE
     * @param {Uint32Array} data Data
     * @param {Uint32Array} key  Key
     * @param {Uint32Array} iv   IV
     */
    igeDecrypt(data, key, iv) {
        return this.asyncTask({
            task: 'igeDecrypt',
            data,
            key,
            iv
        })
    }
    /**
     * Get continuous CTR processor
     * @param {Uint32Array} iv 
     * @param {Uint32Array} key 
     * @returns CtrProcessor
     */
    getCtr(key, iv) {
        return this.asyncTask({
            task: 'initCtr',
            key,
            iv
        }).then(id => {
            return {
                process: this.asyncCtrTask.bind({
                    task: 'ctr',
                    wrapper: this,
                    id
                }),
                close: this.asyncCtrTask.bind({
                    task: 'ctrClose',
                    wrapper: this,
                    id
                }),
            }
        })
    }

    asyncCtrTask(data) {
        return this.wrapper.asyncTask({
            task: this.task,
            ctrId: this.id,
            data
        })
    }
}
export default CryptoWorker