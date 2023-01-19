const mongoose = require('mongoose');

const dataSchema = new mongoose.Schema({
    hash: {
        required: true,
        type: String
    },
    tokenAd: {
        required: true,
        type: String
    },
    tokenAm: {
        required: true,
        type: String
    },
    account: {
        required: true,
        type: String
    },
    fee: {
        required: true,
        type: String
    },
    timestamp: {
        required: true,
        type: String
    },
    delay: {
        required: true,
        type: String
    },
    used: {
        required: true,
        type: Boolean
    },
    withdrawtx: {
        required: false,
        type: String
    },
    wttimestamp: {
        required: false,
        type: String
    },
})
dataSchema.index({hash:1}, {unique: true})
module.exports = mongoose.model('Data', dataSchema)