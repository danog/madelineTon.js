# MadelineTon.js

Pure JS client-side implementation of the [Telegram TON blockchain protocol](https://test.ton.org).  

Interact **directly with the TON blockchain** with no middlemans, directly from your browser!  

This is possible thanks to a client-side implementation of the ADNL P2P protocol ([whitepaper](https://test.ton.org/ton.pdf)).  
Connection to the liteservers is made through a simple [websocket proxy](https://github.com/danog/tonProxy) that simply acts as a TCP <=> websocket proxy.  

**All cryptography is done exclusively in the browser, allowing fully secure interaction with the chosen TON node**.

The client is fully asynchronous, making use of workers and/or browser webcrypto APIs for cryptography (curves & AES).

## Usage

This project provides an ADNL protocol lite-client, allowing to fetch blocks from the TON blockchain and send ext messages to the validators.  

Possible applications are entirely client-side off-chain components for a distributed TON project; API explorers; and much more!  

```js
import Lite from 'madeline-ton/lite';
import BitStream from "madeline-ton/boc/bitstream";

const liteClient = new Lite()

liteClient.connect().then(async () => {
    console.log("Connected!")

    console.log(await liteClient.getVersion())
    console.log(await liteClient.getTime())
    console.log(await liteClient.methodCall('liteServer.getMasterchainInfo'))

    await liteClient.last()
    const state = await liteClient.methodCall('liteServer.getAccountState', {
        account: 'EQAnoW6-IZHisrcCsiSFDewx79W4oYfocKveh3b44uNIIepe'
    })
    console.log(state)

    let stream = new BitStream(state.state.buffer)
    console.log("CRC", stream.readBits(32))
    console.log("Has index", stream.readBits(1))
    console.log("Has crc32c", stream.readBits(1))
    console.log("Has cache bits", stream.readBits(1))
    console.log("Flags", stream.readBits(2))
    console.log("Size", stream.readBits(3))
    console.log("off_bytes", stream.readBits(8))
})
```

By default, the lite client will connect and authorize to the endpoints specified in the [testnet config file](https://test.ton.org/ton-lite-client-test1.config.json), however you can provide your own config to the constructor (all fields are optional and will be filled automatically if missing):

```js
const liteClient = new Lite({
    config: liteConfig, // Contents of ton-lite-client-test1.config.json
    wssProxies: {       // Websocket proxy endpoints, per-IP
        1137658550: 'wss://ton-ws.madelineproto.xyz/testnet'
    },
    schemes: {
        1: schemeTON, // ton API TL scheme JSON file
        2: schemeLite // lite API TL scheme JSON file
    },
})
```


For a list of methods that can be used, take a look at the lite scheme files (in a few days will provide an automatically-generated doc here).



The project is actually based on yet another project of mine, a pure JS Telegram MTProto client (madeline.js) which will be released soon.