class Tester {
    compare(a, b, name) {
        b = new Uint32Array(b)
        console.log(a, b)
        for (let i = 0; i < b.length; i++) {
            if (a[i] != b[i]) {
                console.log("Data at " + i + " is different in " + name + "! " + a[i] + " != " + b[i])
                return
            }
        }
        console.log("OK " + name + ": data is the same!")
    }
    test() {
        const input = new Uint32Array([0, 12, 3, 4, 214, 14364, 4633, 21172, 21492, 127856, 597458, 87]);
        const expected = new Uint32Array([1965066766, 3647278943, 949049929, 1156405627, 2696884890, 2601192231, 2300300808, 4270421025, 1649691074, 2710313659, 2410003310, 1216036349])

        const key = new Uint32Array([124, 2, 241, 12442]);
        const iv = new Uint32Array([124, 2, 241, 212442, 2124, 2, 241, 12442])

        const keyCtr = new Uint32Array([124, 2, 241, 12442]);
        const ivCtr = new Uint32Array([0x0, 0xFF, 0xFF, 16777471])


        console.log("Starting sync tests")
        let output = new Uint32Array(igeEncrypt(input, key, iv))

        this.compare(expected, output, "IGE encrypt")
        this.compare(input, igeDecrypt(output, key, iv), "IGE decrypt")
        console.log(fastRandomInt(), secureRandomInt())
        console.log("Done sync tests")


        console.log("Starting async tests")
        const magic = new CryptoAsync

        magic.secureRandomInt().then(r => console.log("Got " + r))
        magic.igeEncrypt(input.slice(), key, iv).then(encOutput => {
            console.log(encOutput)
            this.compare(expected, encOutput, "IGE encrypt async")
            return magic.igeDecrypt(new Uint32Array(encOutput), key, iv)
        }).then(decOutput => this.compare(input, decOutput, "IGE decrypt async"))


        magic.getCtr(keyCtr, ivCtr)
            .then(processor => {
                processor.process(new Uint32Array([0, 241]))
                    .then(r => this.compare([92269973, 2836914949, ], r, "CTR encrypt 1"))
                processor.process(new Uint32Array([21251, 51251, 634773, 9698]))
                    .then(r => this.compare([1363817764, 2809683999, 1009867213, 1432250144, ], r, "CTR encrypt 2"))
                processor.process(new Uint32Array([421251, 251251, 6347732, 29698, 12581952, 62623, 3262623, 2158922]))
                    .then(r => this.compare([4268967802, 218077614, 3019262837, 2105238177, 311251093, 737408079, 2456202660, 3949939564, ], r, "CTR encrypt 3"))
                    .then(_ => processor.close())
            })
    }
}