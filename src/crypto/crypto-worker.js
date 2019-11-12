import {
    useWebCryptoRandom
} from "../crypto-sync/poly";
import CWorker from './c.worker'

class CryptoWorker {
    taskId = 0
    tasks = []
    constructor(timeout) {
        this.timeout = timeout || 5 * 60 // Change later

        this.worker = new CWorker()
        if (!useWebCryptoRandom && window) {
            window.onkeydown = window.onclick = () => this.worker.postMessage({
                task: 'seed'
            })
        }
        this.worker.onmessage = this.onMessage.bind(this)
    }
    onMessage(message) {
        if (this.tasks[message['id']]) {
            this.tasks[message['id']](message['result'])
        }
    }
    asyncTask(params) {
        params['id'] = this.tasks.length
        return [
            params['id'],
            new Promise((resolve, reject) => {
                this.tasks.push(resolve)
                setTimeout(reject, this.timeout, params['id'])
                this.worker.postMessage(params)
            })
        ]
    }
    factorize(what) {
        return this.asyncTask({
            task: 'factorize',
            what
        })
    }
    secureRandom(buffer) {
        return this.asyncTask({
            task: 'secureRandom',
            buffer
        })
    }
    secureRandomInt(mod) {
        return this.asyncTask({
            task: 'secureRandom',
            mod
        })
    }
    sha1(buffer) {
        return this.asyncTask({
            task: 'sha1',
            buffer
        })
    }
    sha256(buffer) {
        return this.asyncTask({
            task: 'sha256',
            buffer
        })
    }
    igeEncrypt(data, key, iv) {
        return this.asyncTask({
            task: 'igeEncrypt',
            data,
            key,
            iv
        })
    }
    igeDecrypt(data, key, iv) {
        return this.asyncTask({
            task: 'igeDecrypt',
            data,
            key,
            iv
        })
    }
    getCtr(key, iv) {
        return this.asyncTask({
            task: 'initCtr',
            key,
            iv
        }).then(id => {
            process: this.asyncCtrTask.bind({
                wrapper: this,
                id
            })
        })
    }

    asyncCtrTask(data) {
        return this.wrapper.asyncTask({
            task: 'ctr',
            id: this.id,
            data
        })
    }
}
export default CryptoWorker