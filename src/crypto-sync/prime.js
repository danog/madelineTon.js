import {
    eGCD_,
    greater,
    divide_,
    equalsInt,
    isZero,
    bigInt2str,
    copy_,
    copyInt_,
    rightShift_,
    sub_,
    add_,
    bpe,
    one,
    int2bigInt,
    leftShift_,
    str2bigInt,
    mult_,
    equals,
    mult
} from 'leemon'
import Long from '../lib/bigint/long'
import {
    fastRandomInt
} from './random'
import Stream from '../TL/stream'

/**
 * Convert P and Q to two big-endian byte arrays
 * @param {string} PBig P
 * @param {string} QBig Q
 * @returns Uint8Array[]
 */
const toBuffers = (PBig, QBig) => {
    PBig = Stream.switcheroo(PBig)
    QBig = Stream.switcheroo(QBig)
    let stream = new Stream(new ArrayBuffer(8))
    stream.writeUnsignedInt(PBig).writeUnsignedInt(QBig)
    stream = stream.getBuffer()
    return [new Uint8Array(stream, 0, 4), new Uint8Array(stream, 4, 4)]
}

/**
 * Factorize using long library from Google Closure.
 * 
 * Usually the fastest on modern machines.
 * 
 * @param {number[]} PQ, low and high parts
 * @returns Uint8Array[] Factors
 */
const long = what => {
    var g
    for (var i = 0; i < 3; i++) {
        var q = Long.fromInt((fastRandomInt(128) & 15) + 17)
        var x = Long.fromInt(fastRandomInt(1000000000) + 1)
        var y = x
        var lim = 1 << (i + 18)

        for (var j = 1; j < lim; j++) {
            var a = x
            var b = x
            var c = q
            while (b.notEquals(Long.ZERO)) {
                if (b.and(Long.ONE).notEquals(Long.ZERO)) {
                    c = c.add(a)
                    if (c.compare(what) > 0) {
                        c = c.subtract(what)
                    }
                }
                a = a.add(a)
                if (a.compare(what) > 0) {
                    a = a.subtract(what)
                }
                b = b.shiftRight(1)
            }

            x = c
            var z = x.compare(y) < 0 ? y.subtract(x) : x.subtract(y)
            g = z.gcd(what)
            if (g.notEquals(Long.ONE)) {
                break
            }
            if ((j & (j - 1)) == 0) {
                y = x
            }
        }
        if (g.compare(Long.ONE) > 0) {
            break
        }
    }

    var f = what.div(g),
        P, Q

    if (g.compare(f) > 0) {
        P = f
        Q = g
    } else {
        P = g
        Q = f
    }

    if (P.multiply(Q).notEquals(what)) {
        throw new Error(`Failure factorizing (long): ${P} * ${Q} != ${what}`)
    }

    return toBuffers(P.toString(10), Q.toString(10))
}

/**
 * Factorize using leemon library
 * 
 * Slowest module, for some reason the most reliable on (very) old hardware
 * 
 * @param {number} PQ, low and high parts
 * @returns Uint8Array[] Factors
 */
const leemon = what => {
    what = str2bigInt(what, 16, Math.ceil(64 / bpe) + 1)

    var minBits = 64
    var minLen = Math.ceil(minBits / bpe) + 1
    var i, q
    var j, lim
    var g, P
    var Q
    var a = new Array(minLen)
    var b = new Array(minLen)
    var c = new Array(minLen)
    var g = new Array(minLen)
    var z = new Array(minLen)
    var x = new Array(minLen)
    var y = new Array(minLen)

    for (i = 0; i < 3; i++) {
        q = (fastRandomInt(128) & 15) + 17
        copyInt_(x, fastRandomInt(1000000000) + 1)
        copy_(y, x)
        lim = 1 << (i + 18)

        for (j = 1; j < lim; j++) {
            copy_(a, x)
            copy_(b, x)
            copyInt_(c, q)

            while (!isZero(b)) {
                if (b[0] & 1) {
                    add_(c, a)
                    if (greater(c, what)) {
                        sub_(c, what)
                    }
                }
                add_(a, a)
                if (greater(a, what)) {
                    sub_(a, what)
                }
                rightShift_(b, 1)
            }

            copy_(x, c)
            if (greater(x, y)) {
                copy_(z, x)
                sub_(z, y)
            } else {
                copy_(z, y)
                sub_(z, x)
            }
            eGCD_(z, what, g, a, b)
            if (!equalsInt(g, 1)) {
                break
            }
            if ((j & (j - 1)) == 0) {
                copy_(y, x)
            }
        }
        if (greater(g, one)) {
            break
        }
    }

    divide_(what, g, x, y)

    if (greater(g, x)) {
        P = x
        Q = g
    } else {
        P = g
        Q = x
    }

    if (!equals(mult(P, Q), what)) {
        throw new Error(`Failure factorizing (leemon): ${bigInt2str(P)} * ${bigInt2str(Q)} != ${bigInt2str(what)}`)
    }

    return toBuffers(bigInt2str(P, 10), bigInt2str(Q, 10))
}

/**
 * Universal factorization
 * 
 * @param {Uint8Array} Array of bytes with PQ
 * @returns Uint8Array[] Factors
 */
const factorize = what => {
    what = new Stream(what.buffer)
    const high = Stream.switcheroo(what.readSignedInt()),
        low = Stream.switcheroo(what.readSignedInt())
    what = new Long(low, high)

    try {
        return long(what)
    } catch (e) {
        console.log("Error while factorizing with long: " + e)
    }
    try {
        return leemon(what.toString(16))
    } catch (e) {
        console.log("Error while factorizing with leemon: " + e)
    }
}

export default factorize