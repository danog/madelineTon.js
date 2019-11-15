import Objects from "./TL/objects";
import Parser from "./TL/parser";
import DataCenter from "./datacenter";

class API
{
    constructor(settings) {
        this.TLObjects = new Objects(settings['schemes'])
        this.TLParser = new Parser(this.TLObjects)
        this.datacenter = new DataCenter
    }
    async connect() {
        for (let x = 1; x <= 5; x++) {
            await this.datacenter.connect(x)
        }
    }
}

export default API