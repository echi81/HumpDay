const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const db = require('../database');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

const app = express();
const jsonParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({ extended: false });
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))


app.use(morgan('dev')); // HTTP request logger middleware for node.js

app.set('view engine', 'ejs'); // sets a view engine to use things from /views folder

app.use(express.static(path.join(__dirname, '..', '/client/dist')));

//app is using express-sessions and stores them in mongo db
app.use(session({
  secret: 'shh.. this is a secret',
  resave: true,
  saveUninitialized: false,
  cookie: {},
  store: new MongoStore({mongooseConnection: db.db})
}));

// function that when used denies access to prohibited resources.
const restrict = (req, res, next) => {
  if ( req.session && req.session.userId ) {
    return next();
  } else {
    req.session.error = 'Access denied!';
    res.sendStatus(403);
  }
}

app.get('/', jsonParser, (req, res, next) => {
  var userId = req.body.userId
  res.render('index', {userId: req.url.split('=')[1]});
})

app.get('/login', (req, res) => {
  res.render('index')
})

app.post('/login', (req, res) => {
  db.getUser({name: req.body.email}, (error, result) => {
    result === null || result.length === 0 ? res.status(404).send(`Invalid credentials`) :
      bcrypt.hash(req.body.password, result.salt, function(err, hash) {
        if ( hash === result.hashedPassword ) {
          req.session.regenerate(() => {
            req.session.userId = result.id;
            res.send({userId: result.id})
          })
        } else {
          res.status(404).send(`Invalid credentials`)
        }
      });
  })
})

app.get('/signup', (req, res) => {
  res.render('index')
})

app.get('/signout', (req, res) => {
  if ( req.session ) {
    req.session.destroy((err) => {
      err ? console.log(err) : res.redirect('/login')
    })
  }
})

// -- added to test DB --

app.post('/signup', urlencodedParser, (req, res) => {
  console.log(req.body);
  const saltRounds = 10;
  bcrypt.genSalt(saltRounds, function(err, salt) {
    bcrypt.hash(req.body.password, salt, function(err, hash) {
        let formated = {}
        formated.name = req.body.email;
        formated.salt = salt
        formated.hashedPassword = hash
        db.saveUser(formated, (error, success) => {
          error ? res.status(400).send(`Sorry ${error}`) :
          req.session.regenerate(() => {
            req.session.userId = success._id;
            res.send(201, {userId: success._id});
          });
        });
    });
  });

})


app.post('/task', restrict, jsonParser, (req, res) => {
  console.log(req.body);
  db.saveTask(req.body);
  res.sendStatus(201);
})

app.put('/taskCheck/:taskId',urlencodedParser, (req,res) => {
  const taskId = req.params.taskId;
  db.updateTaskOnCheck(taskId, function() {
    res.sendStatus(201)
  })
})

app.put('/taskUnCheck/:taskId',urlencodedParser, (req,res) => {
  const taskId = req.params.taskId;
  db.updateTaskOnUnCheck(taskId, function() {
    res.sendStatus(201)
  })
})

app.get('/task/:userId/:date', urlencodedParser, (req,res) => {
  const userId = req.params.userId;
  const date = req.params.date;
  db.getTasksOnDate(userId, date, function(results) {
    res.send(results)
  })
})

app.delete('/task/:taskId', (req, res) => {
  const taskId = req.params.taskId
  db.deleteTask(taskId, ()=>{
    res.sendStatus(200)
  })
})

app.post('/notes', (req, res) => {
  console.log(req.body);
  db.saveNote(req.body.text, req.body.userId, (newNote) => {
    res.send(201, newNote)
  });

})

app.get('/notes', restrict, (req, res) => {
  const userId = req.url.split('=')[1]
  db.getNotesForUser(userId,  (notes) => {
    res.send(notes);
  })
})

app.delete('/notes', (req, res) => {
  const noteId = req.url.split('=')[1]
  db.deleteNote(noteId, ()=>{
    res.sendStatus(200)
  })
})

// get all users
app.get('/users', urlencodedParser, (req, res) => {
  db.getAllUsers( (users) => {
    res.send(users);
  })
})

// get user by id
app.get('/users/:id', urlencodedParser, (req, res) => {
  db.getUser(req.params, (user) => {
    res.send(user);
  })
})

app.get('/quotes', (req, res) => {
  db.getAllQuotes((result) => {
    res.send(result)
  })
})


app.listen(process.env.PORT || 3000, () => console.log('listening on 3000')); // TODO update this console log

