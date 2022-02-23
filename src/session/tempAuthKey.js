import AuthKey from "./authKey";
import PermAuthKey from "./permAuthKey";

class TempAuthKey extends AuthKey {
    expires_at = 0
    inited = false
    pfs = true
    /**
     * initConnection
     * @param boolean Whether connection was inited
     */
    init(init = true) {
        this.inited = init
    }
    /**
     * Check if connection was inited
     * @returns boolean
     */
    isInited() {
        return this.inited
    }
    /**
     * Bind permanent and temporary auth key
     * @param {PermAuthKey} perm Permanent auth key
     * @param boolean       pfs  Whether to bind using PFS
     */
    bindPerm(perm, pfs = true) {
        this.bound = perm
        const instance = !pfs && perm ? perm : this
        const proto = (pfs && perm ? PermAuthKey : TempAuthKey).prototype
        for (let method of ['getAuthKey', 'setAuthKey', 'getServerSalt', 'setServerSalt', 'hasServerSalt', 'getID']) {
            this[method] = proto[method].bind(instance)
        }
    }
    /**
     * Check if temp auth key is bound
     * @returns boolean
     */
    isBound() {
        return typeof this.bound !== 'undefined'
    }
    /**
     * Check if bound auth key is authorized
     * @returns boolean
     */
    isAuthorized() {
        return this.bound ? this.bound.isAuthorized(): false
    }
    /**
     * Signal that bound auth key was authorized
     * @param {boolean} authorized 
     */
    authorized(authorized) {
        this.bound.authorized(authorized)
    }

    /**
     * Set expiry date of temporary auth key
     * @param {number} expires 
     */
    expires(expires) {
        this.expires_at = expires
    }
    /**
     * Check if auth key has expired
     * @returns boolean
     */
    expired() {
        return Date.now() / 1000 > this.expires_at
    }
}
export default TempAuthKey