import AuthInfo from "./session/authInfo"
import Context from "./network/context"
import Connection from "./connection"
import CryptoAsync from "./crypto"

class DataCenter {
    authInfo = {}
    sockets = {}
    map = ['pluto', 'venus', 'aurora', 'vesta', 'flora']
    connect(dcID, API) {
        if (!this.map[dcID - 1]) {
            throw new Error('Wrong DC ID provided: ' + dcID)
        }
        if (this.sockets[dcID] && this.sockets[dcID].connected) {
            console.log(`Already connected to DC ${dcID}`)
            return
        }
        if (!this.authInfo[dcID]) {
            this.authInfo[dcID] = new AuthInfo
        }

        const ctx = new Context()
        ctx.secure(true).setDcId(dcID).setUri(`${this.map[dcID - 1]}.web.telegram.org`, 443).setCrypto(new CryptoAsync(API.getTL()))

        this.sockets[dcID] = new Connection(this.authInfo[dcID], API)
        return this.sockets[dcID].connect(ctx)
    }
}

export default DataCenter