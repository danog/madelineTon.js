import {
    secureRandom
} from "./crypto-sync/random"
import {
    bufferViewEqual,
    hexToBytes,
    bytesToHex,
    bufferConcat
} from "./tools"
import Stream from "./TL/stream"

class Auther {
    // Use constant keys and don't re-parse them from the beginning, it's pointless anyway since we don't need CDNs
    keys = [{
            e: "010001",
            fp: [
                1827171105,
                3283364610
            ],
            n: "c150023e2f70db7985ded064759cfecf0af328e69a41daf4d6f01b538135a6f91f8f8b2a0ec9ba9720ce352efcf6c5680ffc424bd634864902de0b4bd6d49f4e580230e3ae97d95c8b19442b3c0a10d8f5633fecedd6926a7f6dab0ddb7d457f9ea81b8465fcd6fffeed114011df91c059caedaf97625f6c96ecc74725556934ef781d866b34f011fce4d835a090196e9a5f0e4449af7eb697ddb9076494ca5f81104a305b6dd27665722c46b60e5df680fb16b210607ef217652e60236c255f6a28315f4083a96791d7214bf64c1df4fd0db1944fb26a2a57031b32eee64ad15a8ba68885cde74a5bfc920f6abf59ba5c75506373e7130f9042da922179251f"
        },
        {
            e: "010001",
            fp: [
                2971431579,
                2593745437
            ],
            n: "c6aeda78b02a251db4b6441031f467fa871faed32526c436524b1fb3b5dca28efb8c089dd1b46d92c895993d87108254951c5f001a0f055f3063dcd14d431a300eb9e29517e359a1c9537e5e87ab1b116faecf5d17546ebc21db234d9d336a693efcb2b6fbcca1e7d1a0be414dca408a11609b9c4269a920b09fed1f9a1597be02761430f09e4bc48fcafbe289054c99dba51b6b5eb7d9c3a2ab4e490545b4676bd620e93804bcac93bf94f73f92c729ca899477ff17625ef14a934d51dc11d5f8650a3364586b3a52fcff2fedec8a8406cac4e751705a472e55707e3c8cd5594342b119c6c3293532d85dbe9271ed54a2fd18b4dc79c04a30951107d5639397"
        },
        {
            e: "010001",
            fp: [
                1892543096,
                2958764655
            ],
            n: "b1066749655935f0a5936f517034c943bea7f3365a8931ae52c8bcb14856f004b83d26cf2839be0f22607470d67481771c1ce5ec31de16b20bbaa4ecd2f7d2ecf6b6356f27501c226984263edc046b89fb6d3981546b01d7bd34fedcfcc1058e2d494bda732ff813e50e1c6ae249890b225f82b22b1e55fcb063dc3c0e18e91c28d0c4aa627dec8353eee6038a95a4fd1ca984eb09f94aeb7a2220635a8ceb450ea7e61d915cdb4eecedaa083aa3801daf071855ec1fb38516cb6c2996d2d60c0ecbcfa57e4cf1fb0ed39b2f37e94ab4202ecf595e167b3ca62669a6da520859fb6d6c6203dfdfc79c75ec3ee97da8774b2da903e3435f2cd294670a75a526c1"
        },
        {
            e: "010001",
            fp: [
                3344970723,
                1910515126
            ],
            n: "c2a8c55b4a62e2b78a19b91cf692bcdc4ba7c23fe4d06f194e2a0c30f6d9996f7d1a2bcc89bc1ac4333d44359a6c433252d1a8402d9970378b5912b75bc8cc3fa76710a025bcb9032df0b87d7607cc53b928712a174ea2a80a8176623588119d42ffce40205c6d72160860d8d80b22a8b8651907cf388effbef29cd7cf2b4eb8a872052da1351cfe7fec214ce48304ea472bd66329d60115b3420d08f6894b0410b6ab9450249967617670c932f7cbdb5d6fbcce1e492c595f483109999b2661fcdeec31b196429b7834c7211a93c6789d9ee601c18c39e521fda9d7264e61e518add6f0712d2d5228204b851e13c4f322e5c5431c3b7f31089668486aadc59f"
        }
    ]
    /**
     * 
     * @param {API} API 
     */
    constructor(API) {
        this.API = API
        this.TL = API.getTL()
        this.datacenter = API.getDatacenter()
    }
    async createAuthKey(expires_in, dcId) {
        let crypto = this.datacenter.sockets[dcId].ctx.getCrypto()
        for (let x = 0; x < 5; x++) {
            //try {
            let nonce = new Uint32Array(4)
            await secureRandom(nonce)

            let res = await this.API.methodCall('req_pq_multi', {
                nonce,
            }, {
                dcId,
            })
            if (!bufferViewEqual(nonce, res['nonce'])) {
                throw new Error('Nonce mismatch!')
            }
            let chosenKey
            var fp
            for (let k in res['server_public_key_fingerprints']) {
                fp = res['server_public_key_fingerprints'][k]
                for (let k in this.keys) {
                    if (bufferViewEqual(this.keys[k]['fp'], fp)) {
                        chosenKey = this.keys[k]
                        break
                    }
                }
                if (chosenKey) break
            }
            if (!chosenKey) {
                throw new Error("Couldn't find our key in the fingerprint vector!")
            }

            let server_nonce = res['server_nonce']
            let pq = await crypto.factorize(res['pq'])
            let new_nonce = new Uint32Array(4)
            await secureRandom(new_nonce)

            let payload = new Stream
            this.TL.serialize(payload, {
                _: 'p_q_inner_data' + (expires_in < 0 ? '' : '_temp'),
                pq: res['pq'],
                p: pq[0],
                q: pq[1],
                dc: dcId,
                nonce,
                server_nonce,
                new_nonce,
                expires_in,
            })

            let final = new Uint8Array(255)
            final.set(new Uint8Array(await crypto.sha1(payload.uBuf)), 0)
            final.set(payload.bBuf, 20)
            /*let offset = 20 + payload.getByteLength()
            let random = new Uint8Array(255 - offset)
            await secureRandom(random)
            final.set(random, offset)*/

            final = await crypto.powMod(final, chosenKey['e'], chosenKey['n'])

            let dhParams = await this.API.methodCall('req_DH_params', {
                nonce,
                server_nonce,
                p: pq[0],
                q: pq[1],
                public_key_fingerprint: fp,
                encrypted_data: final
            }, {
                dcId,
            })

            if (!bufferViewEqual(nonce, dhParams['nonce'])) {
                throw new Error('Nonce mismatch!')
            }
            if (!bufferViewEqual(server_nonce, dhParams['server_nonce'])) {
                throw new Error('Server nonce mismatch!')
            }
            if (dhParams['_'] === 'server_DH_params_fail') {
                if (!bufferViewEqual(new Uint8Array(await crypto.sha1(new Uint32Array(new_nonce.buffer)), -32), dhParams['new_nonce_hash'])) {
                    throw new Error('New nonce hash mismatch!')
                }
                continue
            }
            let serverNewHash = new Uint8Array(await crypto.sha1(bufferConcat(dhParams['server_nonce'], new_nonce)))
            let newServerHash = new Uint8Array(await crypto.sha1(bufferConcat(new_nonce, dhParams['server_nonce'])))
            let newNewHash = new Uint8Array(await crypto.sha1(bufferConcat(new_nonce, new_nonce)))

            let tmpAesKey = new Uint32Array(bufferConcat(newServerHash, serverNewHash.subarray(0, 12)).buffer)
            let tmpAesIv = new Uint32Array(bufferConcat(bufferConcat(serverNewHash.subarray(12, 20), newNewHash), new_nonce.subarray(0, 4)).buffer)

            let answer = new Stream(await crypto.igeDecrypt(new Uint32Array(dhParams['encrypted_answer'].buffer), tmpAesKey, tmpAesIv))

            let answerHash = answer.readUnsignedInts(5)
            let server_DH_inner_data = this.TL.deserialize(answer)
            console.log(server_DH_inner_data)
            return
            /*} catch (e) {
                console.error(`Error while generating auth key for DC ${dcId}: ${e} ${e.trace}, retrying (try ${x+1} out of 5)`)
            }*/
        }
        throw new Error("Auth failed!")
    }
    async auth() {
        for (let dcId in this.datacenter.authInfo) {
            let authInfo = this.datacenter.authInfo[dcId]
            if (!authInfo.hasAuthKey(false) || !authInfo.hasAuthKey(true) || !authInfo.isBound()) {
                if (!authInfo.hasAuthKey(false)) {
                    authInfo.setAuthKey(await this.createAuthKey(-1, dcId), dcId)
                }
                if (!authInfo.hasAuthKey(true)) {
                    authInfo.bindPfs(false)
                }
            }
        }
        await this.sync()
    }
    async sync() {
        if (!this.API.loggedIn) {
            return
        }
    }
}

export default Auther