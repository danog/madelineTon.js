import {
    useWebCryptoRandom
} from "../crypto-sync/poly";
import CWorker from './c.worker'

class CryptoWorker {
    constructor(parser, timeout) {
        this.tasks = []
        this.timeout = timeout || 200000 // Change later

        this.worker = new CWorker()
        this.worker.onmessage = this.onMessage.bind(this)

        if (!useWebCryptoRandom && typeof window !== 'undefined') {
            window.onkeydown = window.onclick = () => this.worker.postMessage({
                task: 'seed'
            })
        }
        this.worker.postMessage({
            task: 'init',
            parser
        })
    }
    onMessage(message) {
        message = message['data']
        if (!this.tasks[message['id']]) return
        if (message['e']) {
            this.tasks[message['id']][1](message['e'])
        } else {
            this.tasks[message['id']][0](message['result'])
        }
        delete this.tasks[message['id']]
    }
    asyncTask(params) {
        params['id'] = this.tasks.length
        return new Promise((resolve, reject) => {
            this.tasks.push([resolve, reject])
            setTimeout(() => reject("Crypto worker timeout for task " + params['task'] + "!"), params['task'] === 'factorize' ? 5 * 60 * 1000 : this.timeout, params['id'])
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
     * @returns {ArrayBuffer}
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
     * @returns {ArrayBuffer}
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
     * @returns {ArrayBuffer}
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
     * @returns {ArrayBuffer}
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
     * Bigint PowMod
     * @param {leemonBigInt} b Hex base
     * @param {leemonBigInt} e Hex exponent
     * @param {leemonBigInt} n Hex modulus
     * @returns {leemonBigInt} Result
     */
    powMod(b, e, n) {
        return this.asyncTask({
            task: 'powMod',
            b,
            e,
            n
        })
    }
    /**
     * Check validity of diffie hellman parameters
     * @param {BigInt} p Hex prime
     * @param {BigInt} g Hex generator
     * @param {BigInt} G_ Hex generated
     */
    checkAll(p, g, G_) {
        return this.asyncTask({
            task: 'checkAll',
            p,
            g,
            G_
        })
    }
    /**
     * Check validity of diffie hellman parameters
     * @param {BigInt} G_ Hex generated
     * @param {BigInt} p Hex prime
     */
    checkG(G_, p) {
        return this.asyncTask({
            task: 'checkG',
            G_,
            p,
        })
    }

    /**
     * Deserialize TL payload
     * @param {Stream} data Data
     * @returns {Object}
     */
    deserialize(data) {
        return this.asyncTask({
            task: 'deserialize',
            data,
        })
    }

    /**
     * Get continuous CTR processor
     * @param {Uint32Array} iv 
     * @param {Uint32Array} key 
     * @returns CtrProcessor
     */
    /*
    getCtr(key, iv) {
        return this.asyncTask({
            task: 'ctrInit',
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
    }*/

    asyncCtrTask(data) {
        return this.wrapper.asyncTask({
            task: this.task,
            ctrId: this.id,
            data
        })
    }
}
export default CryptoWorker