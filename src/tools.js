const posMod = (a, b) => {
    const r = -a % b
    return r < 0 ? r + b : r
}

/**
 * Get cryptographically secure integer modulo mod
 * @param {int} mod Modulo
 * @returns number
 */
const randomInt = mod => {
    return window.crypto.getRandomValues(new Uint32Array(1))[0] % (mod || 0xFFFFFFFF)
}
export {
    posMod,
    randomInt
}