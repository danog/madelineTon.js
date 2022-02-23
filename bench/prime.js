if (typeof BigInt !== 'undefined') {
    var zero = BigInt(0)
    var one = BigInt(1)

    function gcd(a, b) {
        while (a != zero && b != zero) {
            while ((b & one) == zero) {
                b >>= one;
            }
            while ((a & one) == zero) {
                a >>= one;
            }
            if (a > b) {
                a -= b;
            } else {
                b -= a;
            }
        }
        return b == zero ? a : b;
    }

    function factorize(what) {
        var g = zero;
        var it = 0
        for (var i = 0; i < 3; i++) {
            var q = BigInt((Math.floor(Math.random() * 127) & 15) + 17);
            var x = BigInt(Math.floor(Math.random() * 1000000000) + 1);
            var y = x;
            var lim = 1 << (i + 18);
            for (var j = 1; j <= lim; j++) {
                it++
                var a = x
                var b = x
                var c = q

                while (b != zero) {
                    if ((b & one) != zero) {
                        c += a;
                        if (c >= what) {
                            c -= what;
                        }
                    }
                    a += a;
                    if (a >= what) {
                        a -= what;
                    }
                    b >>= one;
                }
                x = c;
                z = (x < y) ? y - x : x - y;
                g = gcd(z, what);
                if (g != one) {
                    break;
                }
                if ((j & (j - 1)) === 0) {
                    y = x;
                }
            }
            if (g > one) {
                break;
            }
        }
        p = what;
        return [p < g ? p : g, it]
    }
}