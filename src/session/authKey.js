class AuthKey
{
    /**
     * Set auth key
     * @param {BufferSource} key 
     * @param {BufferSource} ID
     */
    setAuthKey(key, id) {
        this.key = key
        this.id = id
    }
    /**
     * Get auth key 
     * @returns {BufferSource} key
     */
    getAuthKey() {
        return this.key
    }
    /**
     * Get auth key ID
     * @returns {BufferSource}
     */
    getID() {
        return this.id
    }
    /**
     * Set server salt
     * @param {BufferSource} salt 
     */
    setServerSalt(salt) {
        this.salt = salt
    }
    /**
     * Get server salt
     * @returns {BufferSource} salt 
     */
    getServerSalt() {
        return this.salt
    }
    /**
     * @returns boolean Whether the server salt is defined
     */
    hasServerSalt() {
        return typeof this.salt !== 'undefined'
    }
}

export default AuthKey;