# MadelineTon.js

Pure JS client-side implementation of the [Telegram TON blockchain protocol](https://test.ton.org).  

![](https://github.com/danog/madelineTon.js/raw/master/res/screen.png)

Interact **directly with the TON blockchain** with no middlemans, directly from your browser!  

This is possible thanks to a client-side implementation of the ADNL P2P protocol ([whitepaper](https://test.ton.org/ton.pdf)).  
Connection to the liteservers is made through a simple [websocket proxy](https://github.com/danog/tonProxy) that simply acts as a TCP <=> websocket proxy.  

**All cryptography is done exclusively in the browser, allowing fully secure interaction with the chosen TON node**.

The client is fully asynchronous, making use of workers and/or browser webcrypto APIs for cryptography (curves & AES).

Possible applications are entirely client-side off-chain components for a distributed TON project; API explorers; and much more!  

---

This is my submission for the second stage of the TON blockchain contest.

Initially, I intended to submit an [OUTPACE-inspired](https://github.com/AdExNetwork/adex-protocol#ocean-based-unidirectional-trust-less-payment-channel-outpace) ad network controlled by the TON blockchain.  

However, as I studied the concepts of OUTPACE payment channels, I realized that OUTPACE is a suboptimal solution in the context of the TON blockchain.

The TON blockchain is an incredibly powerful and flexible blockchain:
In the [whitepaper](https://test.ton.org/ton.pdf), the TON blockchain is proposed as a solution to all scalability issues of previous blockchains: with support for infinite sharding and most importantly **custom workchains**, the need for side-chain applications like PLASMA and OUTPACE is removed, allowing developers to simply write their own workchain instances with custom rules.

I initially decided to develop a custom TON workchain for the needs of my ad network, but then realized that I first needed a way to interact with the TON network, first.  
Which is why I developed this pure-JS lite-client, which can be directly downloaded by the users viewing ads, and used to directly send an external event to the on-chain ad network smart contract.

I initially intended to create also a very basic ad network smart contract, but then decided to focus all efforts on finishing this library, first.

TL-B parser, fift interpreter and TVM are all on the roadmap in this order (TL-B in particular should be pretty easy with the current TL parser and my bitstream.js, with the only real problem being template parameters (damn you Unary)).
BOC deserialization is implemented in lite.js (builder/slice is represented by a BitStream, a cell is a Uint8Array).


## Other projects

[MadelineProto with TON integration](https://github.com/danog/MadelineProto) - fully separate, standalone, async PHP implementation of the TON lite-client protocol.

## Install

Yarn:

```bash
yarn add madeline-ton
```

NPM (ew :):
```bash
npm install madeline-ton
```

## Usage

This project provides an ADNL protocol lite-client, allowing to fetch blocks from the TON blockchain and send ext messages to the validators.  

```js
import Lite from 'madeline-ton';

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
    console.log(liteClient.slice(state.state)) // Deserialize BOC
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
