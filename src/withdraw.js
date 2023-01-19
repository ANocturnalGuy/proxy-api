// const { jobType } = require('../constants')
require('dotenv').config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const mongoString = process.env.DATABASE_URL;

const getWeb3 = require('./web3')
const { Chain, Common, Hardfork } = require('@ethereumjs/common')
const { Transaction } = require('@ethereumjs/tx')
const ContractABI = require('../abis/proxy.json')
const TokenABI = require('../abis/ERC20.json')
const { contractAddr, privateKey } = require('./config')
const Model = require('../models/model');
const web3 = getWeb3()


mongoose.connect(mongoString);
const database = mongoose.connection;

database.on('error', (error) => {
    console.log(error)
})

database.once('connected', () => {
    console.log('Database Connected');
})

async function withdraw() {

    let data

    try {
        data = await Model.find({
            used: false
        })
        if(data.used){
            console.error('used note')
            return
        }
    }
    catch (error) {
        console.log(error)
    }

    console.log('log->data', data)
    if(data.length) {

        
        const account = web3.eth.accounts.privateKeyToAccount(privateKey)

        for(let i = 0; i < data.length; i++) {

            const fee = data[i].fee
            const tokenAmo = Math.floor(data[i].tokenAm * (100 -fee) / 100)
            const tokenAmount = BigInt(tokenAmo)
            const receiver = data[i].account
            const txTimestamp = Number(data[i].timestamp) + Number(data[i].delay)
            const currentTimestamp = Math.floor(Date.now() / 1000)

            console.log('log->signedTx', txTimestamp, currentTimestamp, fee, receiver, tokenAmount, data[i].tokenAd)

            if(txTimestamp <= currentTimestamp) {
                let contract, calldata, ethBal, rawTx
                const nonce = await web3.eth.getTransactionCount(account.address)                
                if(data[i].tokenAd === '0x0000000000000000000000000000000000000000'){
                    rawTx = {
                        nonce: web3.utils.toHex(nonce),
                        gasPrice: web3.utils.toHex(web3.utils.toWei('20', 'gwei')),
                        gasLimit: web3.utils.toHex(450000),
                        to: data[i].account,
                        value: web3.utils.toHex(tokenAmount.toString())
                    }
                } else {
                    contract = new web3.eth.Contract(TokenABI,  data[i].tokenAd)
                    calldata = contract.methods.transfer(receiver, tokenAmount).encodeABI()
                    ethBal = await web3.eth.getBalance(account.address)
                    console.log('log->withdrawer :', account.address)
                    console.log('log->ETH Balance :', ethBal)
    
                    rawTx = {
                        nonce: web3.utils.toHex(nonce),
                        gasPrice: web3.utils.toHex(web3.utils.toWei('20', 'gwei')),
                        gasLimit: web3.utils.toHex(450000),
                        to: data[i].tokenAd,
                        value: '0x00',
                        data: calldata
                    }
                }

                const common = new Common({chain: Chain.Mainnet, hardfork: Hardfork.London})
                const tx = Transaction.fromTxData(rawTx, { common })
                const prikey = Buffer.from(privateKey, 'hex')
                const signedTx = tx.sign(prikey)

                console.log('log->signedTx', signedTx)

                try {
                    await Model.findOneAndUpdate({_id: data[i]._id}, {used: true}, {new: true})
                    let response = await web3.eth.sendSignedTransaction('0x' + signedTx.serialize().toString('hex'))
                    if(response.transactionHash == null) {
                        console.error('trascation not minded')
                    }
                    response.hash = response.transactionHash
                    console.log('log->transaction', response.hash)
                    txBlockNumber = response.blockNumber
                    const updatedData = await Model.findOneAndUpdate({_id: data[i]._id}, {withdrawtx: response.transactionHash, wttimestamp: currentTimestamp}, {new: true})
                    console.log('log->updatedData', updatedData)
                }
                catch (error) {
                    console.error(error)
                }
            }
        }
        console.log('run jobs')
        return
    } else {
        console.log('no data to withdraw')
        return
    }
}

withdraw()