import Websocket from "./websocket";

let Socket = typeof window.WebSocket !== 'undefined' ? Websocket : Http

export default Socket