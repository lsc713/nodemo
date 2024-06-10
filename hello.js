require('dotenv').config();
const express = require('express')
const app = express()

app.use(express.static(__dirname+'/public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended:true}))

const { MongoClient } = require('mongodb')

let db
const url = process.env.MONGODB_URI
new MongoClient(url).connect().then((client)=>{
    console.log('DB연결성공')
    db = client.db('posting')

    app.listen(8083, () => {
        console.log('http://localhost:8080 에서 서버 실행중')
    })

}).catch((err)=>{
    console.log(err)
})

app.listen(8080, ()=>{
    console.log('http://localhost:8080')
})

app.get('/',(req,res)=>{
    res.sendFile(__dirname + '/index.html')
})

app.get('/news',(req,res)=>{
    db.collection('post').insertOne({title : 'hello'})
})

app.get('/list',async (req,res)=>{
    let result = await db.collection('post').find().toArray()
    console.log(result)
    res.render('list.ejs',{posts : result})
})

app.get('/time', (req,res)=>{
    res.render('date.ejs',{data : new Date()})
})

app.get('/write', (req,res)=>{
    res.render('write.ejs')
})

app.post('/newpost', async (req,res)=>{

    try{
        if(req.body.title === ""){
            res.send('not allowed')
        } else {
            await db.collection('post').insertOne({title:req.body.title,contents:req.body.contents})
            res.redirect('/list')
        }
    }catch (e) {
        console.log(e)
        res.status(500).send("error occured")
    }
})

