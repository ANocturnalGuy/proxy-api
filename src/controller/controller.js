// const { jobType } = require('../constants')
const getWeb3 = require('../web3')
const ABICoder = require('web3-eth-abi/lib')
const { Chain, Common, Hardfork } = require('@ethereumjs/common')
const { Transaction } = require('@ethereumjs/tx')
const ContractABI = require('../../abis/proxy.json')
const { contractAddr, privateKey } = require('../config')
const Model = require('../../models/model');
const BigNumber = require('bignumber.js')
const web3 = getWeb3()

let interval;
const max_attempts = 20;
let attempts = 0;

async function add(req, res) {

    // const tokenAmo = Math.floor(req.body.tokenAm * (100 -req.body.fee) / 100)
    // const tokenAmount = BigInt(tokenAmo)
    
    // console.log('log->eth amount', tokenAmo, tokenAmount)
    // console.log('log->eth amount', web3.utils.toWei('0.1', "ether"))
    // console.log('log->eth amount', web3.utils.toHex(tokenAmount))
    
    // res.status(400).json({ message: 'not found' })
    // return false


    const hash = req.body.hash
    let txAmount = 0

    const exist = await Model.findOne({
        hash: hash,
    });

    console.log('log->exist', exist)
    if(exist) {
        res.status(400).json({ message: 'not found' })
        return false
    }

    const receipt = await web3.eth.getTransactionReceipt(hash)
    // console.log('log->receipt', receipt)
    if(req.body.tokenAd.toUpperCase() !== "0X0000000000000000000000000000000000000000"){
        for(let i=0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i]
            if(log.address.toUpperCase() === req.body.tokenAd.toUpperCase()){
                console.log('log->log', log)
                if(log.topics[2]){
                    const meAddress = web3.eth.abi.decodeParameter("address", log.topics[2]);
                    console.log('log->meAddress', meAddress)
                    if(meAddress.toUpperCase() === '0xaA767b5A3AA9fBc11F682b1118D8064f39D95515'.toUpperCase()){
                        txAmount = new BigNumber(log.data).toFixed();
                        console.log('log->txAmount', txAmount)
                    }
                }
            }
        }
    } else {
        console.log('log->sell action')
        let flag = true;
        for(let i=0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i]
            console.log('log->log', log)
            // if(web3.eth.abi.decodeParameter("address", log.topics[1]).toUpperCase() === '0xaA767b5A3AA9fBc11F682b1118D8064f39D95515') {
            //     flag = true;
            // }
            if(log.address.toUpperCase() === "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toUpperCase()){
                console.log('log->log', log)
                txAmount = new BigNumber(log.data).toFixed()
                console.log('log->txAMount', txAmount)
            }
        }
        if(!flag) {
            txAmount = 0;
        }
    }

    if(txAmount > 0) {
        try {
            const data = new Model({
                hash: req.body.hash,
                tokenAd: req.body.tokenAd,
                tokenAm: txAmount,
                account: req.body.account,
                fee: req.body.fee,
                timestamp: req.body.timestamp,
                delay: req.body.delay,
                used: false,
            })
            const dataToSave = await data.save();
            console.log('log->dataToSave', dataToSave)
            res.json(dataToSave)
        }
        catch (error) {
            res.status(400).json({ message: error.message })
        }
    }
    else{
        res.status(400).json({ message: 'not found' })
        return false
    }
}

async function updateData(res, response, txBlockNumber) {

    const currentBlockNumber = await web3.eth.getBlockNumber()
    const confirmations = currentBlockNumber - txBlockNumber
    console.log('log->confirmations-> ', confirmations, attempts)
    if(confirmations >= 0){
        clearInterval(interval)
        res.status(200).json(response)
        attempts = 0
        console.log('log->database attempts ', attempts)
    }

    if(attempts >= max_attempts){
        clearInterval(interval);
        res.status(500).json({ message: `Transaction was not processed in ${attempts} attempts` })
        attempts = 0
    }
    attempts += 1;
}

async function withdraw(req, res) {

    let data

    try {
        data = await Model.find({
            used: false
        })
        if(data.used){
            res.status(400).json({ message: 'used note'})
            return
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }

    if(data.length) {

        const contract = new web3.eth.Contract(ContractABI, contractAddr)
        const account = web3.eth.accounts.privateKeyToAccount(privateKey)

        for(let i = 0; i < data.length; i++) {

            const fee = data[i].fee
            const tokenAmo = Math.floor(data[i].tokenAm * (100-fee) / 100)
            const tokenAmount = BigInt(tokenAmo)
            const receiver = data[i].account
            const txTimestamp = Number(data[i].timestamp) + Number(data[i].delay)
            const currentTimestamp = Math.floor(Date.now() / 1000)

            console.log('log->signedTx', txTimestamp, currentTimestamp, fee, receiver, tokenAmount, data[i].tokenAd)

            if(txTimestamp <= currentTimestamp) {

                const calldata = contract.methods.withdraw(data[i].tokenAd, tokenAmount, receiver).encodeABI()
                const ethBal = await web3.eth.getBalance(account.address)
                console.log('log->withdrawer :', account.address)
                console.log('log->ETH Balance :', ethBal)

                const nonce = await web3.eth.getTransactionCount(account.address)

                const rawTx = {
                    nonce: web3.utils.toHex(nonce),
                    gasPrice: web3.utils.toHex(web3.utils.toWei('20', 'gwei')),
                    gasLimit: web3.utils.toHex(500000),
                    to: contractAddr,
                    value: '0x00',
                    data: calldata
                }

                const common = new Common({chain: Chain.Mainnet, hardfork: Hardfork.London})
                const tx = Transaction.fromTxData(rawTx, { common })
                const prikey = Buffer.from(privateKey, 'hex')
                const signedTx = tx.sign(prikey)

                console.log('log->signedTx', signedTx)

                try {
                    let response = await web3.eth.sendSignedTransaction('0x' + signedTx.serialize().toString('hex'))
                    if(response.transactionHash == null) {
                        res.status(500).json({ message: `Transaction  not mined` })
                    }
                    response.hash = response.transactionHash
                    console.log('log->transaction', response.hash)
                    txBlockNumber = response.blockNumber
                    const updatedData = await Model.findOneAndUpdate({_id: data[i]._id}, {used: true, withdrawtx: response.transactionHash, wttimestamp: currentTimestamp}, {new: true})
                    console.log('log->updatedData', updatedData)
                }
                catch (error) {
                    res.status(500).json({ message: error.message })
                }
            } else {
                continue;
            }
        }
        res.status(200).json({ message: 'run all jobs'})
    } else {
        res.status(400).json({ message: 'no data to withdraw'})
    }
}


async function speedup(req, res) {

    // const data = await Model.findOne({
    //     _id: req.body.id,
    // });

    // console.log('log->data', data)
    // if(data.used) {
    //     res.status(500).json({ message: `Transaction mined` })
    //     return
    // }

    const nonce = req.body.nonce;
    const contract = new web3.eth.Contract(ContractABI, contractAddr)
    const calldata = contract.methods.withdraw(req.body.token, req.body.amount, req.body.receiver).encodeABI()

    const rawTx = {
        nonce: web3.utils.toHex(nonce),
        gasPrice: web3.utils.toHex(web3.utils.toWei('30', 'gwei')),
        gasLimit: web3.utils.toHex(500000),
        to: contractAddr,
        value: '0x00',
        data: calldata
    }

    const common = new Common({chain: Chain.Mainnet, hardfork: Hardfork.London})
    const tx = Transaction.fromTxData(rawTx, { common })
    const prikey = Buffer.from(privateKey, 'hex')
    const signedTx = tx.sign(prikey)

    console.log('log->signedTx', signedTx)
    try {
        let response = await web3.eth.sendSignedTransaction('0x' + signedTx.serialize().toString('hex'))
        if(response.transactionHash == null) {
            res.status(500).json({ message: `Transaction not mined` })
        }
        response.hash = response.transactionHash
        console.log('log->transaction', response.hash)
        // txBlockNumber = response.blockNumber
        // const updatedData = await Model.findOneAndUpdate({_id: data[i]._id}, {used: true, withdrawtx: response.transactionHash, wttimestamp: currentTimestamp}, {new: true})
        // console.log('log->updatedData', updatedData)
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
}

module.exports = {
    add,
    withdraw,
    speedup
}