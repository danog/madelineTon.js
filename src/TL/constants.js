import Stream from "./stream"

let obf2 = [1198675536, 542393671, 1414745936, 1145128264, 4008636142, 3722304989]
if (Stream.bigEndian) {
    obf2.map(Stream.switcheroo)
}
export {
    obf2
}