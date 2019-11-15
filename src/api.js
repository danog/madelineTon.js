import Objects from "./TL/objects";
import Parser from "./TL/parser";
import DataCenter from "./datacenter";
import Auther from "./auth";

class API
{
    loggedIn = false
    lastDc = 4
    layer = 105

    constructor(settings) {
        this.settings = settings

        this.TLObjects = new Objects(settings['schemes'])
        this.TLParser = new Parser(this.TLObjects)
        this.datacenter = new DataCenter
        this.auther = new Auther(this)
    }
    async connect() {
        let promises = []
        for (let x = 1; x <= 5; x++) {
            promises.push(this.datacenter.connect(x, this))
            break
        }
        await Promise.all(promises)
        console.log("Done connecting to DCs!")
        await this.auther.auth()
    }
    methodCall(method, args, aargs) {
        if (aargs['dcId']) {
            this.lastDc = aargs['dcId']
        }
        return this.datacenter.sockets[this.lastDc].methodCall(method, args, aargs)
    }
    getTL() {
        return this.TLParser
    }
    getDatacenter() {
        return this.datacenter
    }
}

export default API