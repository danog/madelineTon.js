import AuthInfo from "./session/authInfo"
import Context from "./network/context"
import Connection from "./connection"

class DataCenter {
    authInfo = {}
    sockets = {}
    map = ['pluto', 'venus', 'aurora', 'vesta', 'flora']
    connect(dcID) {
        if (!map[dcID]) {
            throw new Error('Wrong DC ID provided: ' + dcID)
        }
        if (!this.authInfo[dcID]) {
            this.authInfo[dcID] = new AuthInfo
        }

        const context = new Context
        context.secure(1)
        context.setUri(`${this.map[dcID - 1]}.web.telegram.org`, 443)
        context.setCrypto(this.crypto)

        this.sockets[dcId] = new Connection
        this.sockets[dcId].setExtra(this.authInfo)
        return this.sockets.connect(context)
    }
}

export default DataCenter