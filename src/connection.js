import Socket from "./network"
import Stream from "./TL/stream"

class Connection {
    /**
     * 
     * @param {AuthInfo} shared 
     * @param {API} API 
     */
    setExtra(authInfo, API) {
        this.authInfo = authInfo
        this.API = API
    }
    /**
     * Connect to datacenter
     * @param {Context} ctx 
     */
    async connect(ctx) {
        this.dc = ctx.getDcId()
        this.connection = new Socket
        this.connection.onMessage = this.onMessage.bind(this)
        await this.connection.connect(ctx)
    }
    resetSession() {

    }
    /**
     * Parse incoming message
     * @param {ArrayBuffer} message 
     */
    onMessage(message) {
        if (message.byteLength === 4) {
            const error = new Stream(message).readSignedInt()
            if (error === -404) {
                if (this.authInfo.hasAuthKey()) {
                    console.log("Resetting auth key in DC "+this.dc)
                    this.authInfo.setAuthKey(undefined)
                    this.resetSession()

                }
            }
        }
        authInfo = this.authInfo
    }

    sendMessage(message) {
        
    }
}

export default Connection;