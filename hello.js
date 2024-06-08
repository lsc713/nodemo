const express = require('express')
const app = express()

app.use(express.static(__dirname+'/public'))

app.listen(8080, ()=>{
    console.log('http://localhost:8080')
})

app.get('/',(req,res)=>{
    res.sendFile(__dirname + '/index.html')
})

app.get('/news',(req,res)=>{
    res.send('news')
})