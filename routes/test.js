const connectDB = require("../database");
const router = require('express').Router()

let connectDB = require('./../database')

let db
connectDB.then((client)=>{
    console.log('DB연결성공')
    db = client.db(process.env.DB_NAME1)
}).catch((err)=>{
    console.log(err)
})

router.get('/shop/shirts',async (req,res)=>{
    await db.collection('post').find().toArray()
    res.send('shirtsPage')
})

module.exports = router