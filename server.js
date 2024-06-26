require('dotenv').config();
const express = require('express')
const app = express()
const methodOverride = require('method-override')
const bcrypt = require('bcrypt')
const MongoStore = require('connect-mongo')

const { createServer } = require('http')
const { Server } = require('socket.io')
const server = createServer(app)
const io = new Server(server)

app.use(methodOverride('_method'))
app.use(express.static(__dirname+'/public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended:true}))

const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')

const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3')
const s3 = new S3Client({
    region : 'ap-northeast-2',
    credentials : {
        accessKeyId : process.env.AWSS3_A,
        secretAccessKey : process.env.AWSS3_SA
    }
})

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'nodebuckets3test',
        key: function (요청, file, cb) {
            cb(null, Date.now().toString()) //업로드시 파일명 변경가능
        }
    })
})

app.use(passport.initialize())
app.use(session({
    secret: process.env.SSPW,
    resave : false,
    saveUninitialized : false,
    cookie : {maxAge : 60*60*1000},
    store : MongoStore.create({
        mongoUrl : process.env.MONGODB_URI,
        dbName : 'posting'
    })
}))

app.use(passport.session())

const { MongoClient,ObjectId } = require('mongodb')

let connectDB = require('./database')

let db
let changeStream
connectDB.then((client)=>{
    console.log('DB연결성공')
    db = client.db(process.env.DB_NAME1)

    let condition = [
        { $match : {operationType : 'insert'}}
    ]

    changeStream = db.collection('post').watch()

    server.listen(process.env.PORT, () => {
        console.log('http://localhost:8080 에서 서버 실행중일까?')
    })

}).catch((err)=>{
    console.log(err)
})

app.get('/',(req,res)=>{
    res.sendFile(__dirname + '/index.html')
})

app.get('/news',(req,res)=>{
    db.collection('post').insertOne({title : 'hello'})
})

app.get('/list',async (req,res)=>{
    let result = await db.collection('post').find().toArray()
    res.render('list.ejs',{posts : result})
})

app.get('/time', (req,res)=>{
    res.render('date.ejs',{data : new Date()})
})

app.get('/write', (req,res)=>{
    res.render('write.ejs')
})

app.post('/newpost', upload.single('img1'), async (req,res)=>{
    try{
        if(req.body.title === ""){
            res.send('not allowed')
        } else {
            await db.collection('post').insertOne(
                {title:req.body.title,
                contents:req.body.contents,
                img:req.file ? req.file.location : '',
                user: req.user._id,
                username : req.user.username})
            res.redirect('/list')
        }
    }catch (e) {
        console.log(e)
        res.status(500).send("error occured")
    }
})

app.get('/detail/:id', async (req,res)=>{
    let result2 = await db.collection('comment').find({parentId : new ObjectId(req.params.id)}).toArray()

    try {
        let result = await db.collection('post').findOne({_id: new ObjectId(req.params.id)})
        res.render('detail.ejs',{result:result, result2:result2})
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
    let result = await db.collection('post').deleteOne({
        _id : new ObjectId(req.body.id),
        user : new ObjectId(req.user._id)})
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

passport.use(new LocalStrategy(async (inputId, inputPassword, cb) => {
    let result = await db.collection('user').findOne({ username : inputId})
    if (!result) {
        return cb(null, false, { message: '아이디 DB에 없음' })
    }
    if (await bcrypt.compare(inputPassword, result.password)) {
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
    let result = await db.collection('user').findOne({_id : new ObjectId(user.id)})
    delete result.password
    process.nextTick(() => {
        done(null, result)
    })
})

app.get('/login', (req, res) => {
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

app.get('/register',(req,res)=>{
    res.render('register.ejs')
})

app.post('/register', async (req, res) => {
   let password = await bcrypt.hash(req.body.password, 10)
    await db.collection('user').insertOne({
        username: req.body.username,
        password: password
    })
    res.redirect("/")
});

app.use('/', require('./routes/test'));

// app.get('/search',async (req,res)=>{
//     console.log(req.query.val)
//     let result = await db.collection('post')
//     .find({title: {$regex : req.query.val}}).toArray()
//     res.render('search.ejs',{posts:result})
// })

app.get('/search',async (req,res)=>{
    console.log(req.query.val)
    let searchCondition = [
        {$search : {
                index : 'title_index',
                text : { query : req.query.val, path : 'title' }
            }}
    ]
    let result = await db.collection('post')
    .aggregate(searchCondition).toArray()
    console.log(result)
    res.render('search.ejs',{posts:result})
})

app.post('/comment',async (req,res)=>{
    await db.collection('comment').insertOne({
        content:req.body.content,
        writerId: new ObjectId(req.user._id),
        writer: req.user.username,
        parentId: new ObjectId(req.body.parentId)
    })
    res.redirect('back')
})

app.get('/chat/request',async(req,res)=>{
    let chatroom = await db.collection('chatroom').insertOne({
        member:[req.user._id, new ObjectId(req.query.writerId)],
        date: new Date(),
    });
    res.status(201).redirect('/chat/list');
})


app.get('/chat/list', async(req,res)=>{
    let result = await db.collection('chatroom').find({member : req.user._id}).toArray();
    if(!result){
        return res.status(404).send("chatroom not found");
    }
    res.render('chatList.ejs',{result : result})
})

app.get('/chat/detail/:id', async(req,res)=>{
    let result = await db.collection('chatroom').findOne({_id : new ObjectId(req.params.id)});
    if(!result){
        return res.status(404).send("chatroom not found");
    }
    res.render('chatDetail.ejs',{result : result})
})

io.on('connection',(socket)=>{
    socket.on('ask-join',(data)=>{
        socket.join(data)
    })

    socket.on('message-send',(data)=>{
        console.log(data)
        io.to(data.room).emit('message-broadcast',data.msg)
    })
})

app.get('/stream/list', (req,res)=>{
    res.writeHead(200,{
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": 'no-cache',
    })


    changeStream.on('change',(result)=>{
        console.log(result)
        res.write('event: msg\n')
        res.write(`data: ${JSON.stringify(result.fullDocument)}\n\n`)
    })


})
