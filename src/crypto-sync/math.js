import {
    bytesToHex,
    hexToBytes
} from "../tools"


/**
 * Check validity of G
 * @param {string} G Hex g_*
 * @param {string} p Hex prime
 */
const checkG = (G, p) => {
    
}
/**
 * Check validity of prime
 * @param {string} p Hex prime
 * @param {string} g Hex generator
 */
const checkPG = (p, g) => {
    
}
/**
 * Check validity of diffie hellman parameters
 * @param {*} p Hex prime
 * @param {*} g Hex generator
 * @param {*} G_ Hex generated
 */
const checkAll = (p, g, G_) => checkPG(p, g) && checkG(G_, p)
export {
    checkAll
}