import Objects from "./TL/objects";
import Parser from "./TL/parser";

class API
{
    init(settings) {
        this.TLObjects = new Objects(settings['schemes'])
        this.TLParser = new Parser(this.TLObjects)
    }
}

export default API