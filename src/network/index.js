import Websocket from "./websocket";
import Http from "./http";

let Socket = typeof window.WebSocket == 'undefined' ? Websocket : Http

export default Socket