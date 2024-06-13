const { MongoClient,ObjectId } = require('mongodb')

let db
const url = process.env.MONGODB_URI
let connectDB = new MongoClient(url).connect()

module.exports = connectDB