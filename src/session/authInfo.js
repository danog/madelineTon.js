import TempAuthKey from "./tempAuthKey";

class AuthInfo {
    /**
     * Set auth key
     * @param {AuthKey} key  AuthKey
     * @param {boolean} temp Whether to set temporary or pemanent auth key
     */
    setAuthKey(key, temp = true) {
        if (temp) {
            this.tempAuthKey = key
        } else {
            this.permAuthKey = key
        }
    }
    /**
     * Get auth key
     * @param {boolean} temp Whether to get temporary or permanent auth key
     */
    getAuthKey(temp = true) {
        return temp ? this.tempAuthKey : this.permAuthKey
    }
    /**
     * Check whether temporary or permanent auth key exists
     * @param {boolean} temp 
     */
    hasAuthKey(temp = true) {
        return typeof (temp ? this.tempAuthKey : this.permAuthKey) !== 'undefined'
    }
    /**
     * Bind temporary and permanent auth keys
     * @param {boolean} pfs Whether to bind using PFS
     */
    bindPfs(pfs = true) {
        if (!pfs && !this.tempAuthKey) {
            this.tempAuthKey = new TempAuthKey
        }
        this.tempAuthKey.bindPerm(this.permAuthKey, pfs)
    }

    isBound() {
        return this.tempAuthKey ? this.tempAuthKey.isBound() : false
    }


    isAuthorized() {
        return this.tempAuthKey ? this.tempAuthKey.isAuthorized() : false
    }

    authorized(authorized) {
        if (authorized) {
            this.tempAuthKey.authorized(authorized)
        } else if (this.tempAuthKey) {
            this.tempAuthKey.authorized(authorized)
        }
    }
}

export default AuthInfo;