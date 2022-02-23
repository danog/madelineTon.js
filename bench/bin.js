function randomArray(length, max) {
    return Array.apply(null, Array(length)).map(function () {
        return Math.round(Math.random() * max);
    });
}
var len = 1000;

var rand = randomArray(len * 4, 255);
var buf = Uint8Array.from(rand).buffer


var test1 = new Int32Array(buf)
var init1 = Date.now()
for (var y = 0; y < 10000;y++) {
    for (var x = 0; x < len; x++) {
        var a = test1[x]
        //    console.log(a)
    }
}
var end1 = Date.now()

console.log("====")

document.getElementById('view').innerHTML += "Time A: " + String(end1 - init1) + "<br>"

var test1 = new DataView(buf)
var init1 = Date.now()
for (var y = 0; y < 10000;y++) {

    for (var x = 0; x < len; x++) {
        var a = test1.getInt32(x * 4, true)
        //    console.log(a)

    }
}
var end1 = Date.now()
document.getElementById('view').innerHTML += "Time B: " + String(end1 - init1)