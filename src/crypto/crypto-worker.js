import {
    useWebCryptoRandom
} from "../crypto-sync/poly";
import CWorker from './crypto.worker'

class CryptoWorker {
    taskId = 0
    tasks = []
    constructor(timeout) {
        this.timeout = timeout || 2000

        this.worker = new CWorker()
        if (!useWebCryptoRandom && window) {
            window.onkeydown = window.onclick = this.worker.postMessage({
                task: 'seed'
            }).bind(this.worker)
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
}
export default CryptoWorker