import {
    secureRandom
} from "./crypto-sync/random"

class Auther {
    /**
     * 
     * @param {API} API 
     */
    constructor(API) {
        this.API = API
        this.TL = API.getTL()
        this.datacenter = API.getDatacenter()
    }
    async createAuthKey(expires, dcId) {
        for (let x = 0; x < 5; x++) {
            //try {
                const nonce = new Uint32Array(4)
                await secureRandom(nonce)
                await this.API.methodCall('req_pq', {
                    nonce,
                }, {
                    dcId,
                })
                return 69 
            /*} catch (e) {
                console.log(`Error while generating auth key for DC ${dcId}: ${e}, retrying (try ${x+1} out of 5)`)
            }*/
        }
    }
    async auth() {
        for (let dcId in this.datacenter.authInfo) {
            let authInfo = this.datacenter.authInfo[dcId]
            if (!authInfo.hasAuthKey(false) || !authInfo.hasAuthKey(true) || !authInfo.isBound()) {
                if (!authInfo.hasAuthKey(false)) {
                    authInfo.setAuthKey(await this.createAuthKey(-1, dcId), dcId)
                }
                if (!authInfo.hasAuthKey(true)) {
                    authInfo.bindPfs(false)
                }
            }
        }
        await this.sync()
    }
    async sync() {
        if (!this.API.loggedIn) {
            return
        }
    }
}

export default Auther