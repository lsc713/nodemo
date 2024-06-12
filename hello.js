require('dotenv').config();
const express = require('express')
const app = express()
const methodOverride = require('method-override')

app.use(methodOverride('_method'))
app.use(express.static(__dirname+'/public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended:true}))

const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')

app.use(passport.initialize())
app.use(session({
    secret: '암호화에 쓸 비번',
    resave : false,
    saveUninitialized : false,
    cookie : {maxAge : 60*60*1000}
}))

app.use(passport.session())

const { MongoClient,ObjectId } = require('mongodb')

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

app.get('/detail/:id', async (req,res)=>{

    try {
        let result = await db.collection('post').findOne({_id: new ObjectId(req.params.id)})
        res.render('detail.ejs',{result:result})
        if (result == null) {
            res.send("not allowed")
        }
        console.log(result);
    }catch (e) {
        res.send("that's nono")
    }
})

app.get('/edit/:id', async (req, res) => {
    let result = await db.collection('post').findOne({ _id : new ObjectId(req.params.id)})
    res.render('edit.ejs',{result : result})
});

app.put('/edit', async (req, res) => {
    let result = await db.collection('post').updateOne({ _id : new ObjectId(req.body.id)},
        {$set : {title : req.body.title ,contents : req.body.contents }})
    res.redirect('/list')
});

app.delete('/delete', async (req, res) => {
    let result = await db.collection('post').deleteOne({ _id : new ObjectId(req.body.id)})
    res.send('delete Complete')
});

app.get('/list/:id',async (req,res)=>{
    let result = await db.collection('post').find().skip((req.params.id-1)*5).limit(5).toArray()
    res.render('list.ejs',{posts : result})
})

app.get('/list/next/:id',async (req,res)=>{
    let result = await db.collection('post')
        .find({_id : {$gt : new ObjectId(req.params.id)}})
        .limit(5).toArray()
    res.render('list.ejs',{posts : result})
})

passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
    let result = await db.collection('user').findOne({ username : 입력한아이디})
    if (!result) {
        return cb(null, false, { message: '아이디 DB에 없음' })
    }
    if (result.password == 입력한비번) {
        return cb(null, result)
    } else {
        return cb(null, false, { message: '비번불일치' });
    }
}))

passport.serializeUser((user, done) => {
    process.nextTick(() => {
        done(null, { id: user._id, username: user.username })
    })
})

passport.deserializeUser(async (user, done) => {
    let result = db.collection('user').findOne({_id : new ObjectId(user.id)})
    delete result.password
    process.nextTick(() => {
        done(null, result)
    })
})

app.get('/login', async (req, res) => {
    console.log(req.user)
    res.render('login.ejs')
});

app.post('/login',async (req,res,next)=>{
    passport.authenticate('local',(error,user,info)=>{
        if(error) return res.status(500).json(error)
        if(!user) return res.status(401).json(info.message)
        req.logIn(user, (err)=>{
            if(err) return next(err)
            res.redirect('/')
        })
    })(req,res,next)
})