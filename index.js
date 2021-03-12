if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}
//Initial
const port = process.env.PORT || 3000;
const express = require("express")
const app = express()
const bodyparser = require('body-parser');
const dateFormat = require('dateformat')


//Login and Register
const bcryptjs = require('bcryptjs')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const initializePassport = require('./passport-config')

initializePassport(
    passport,
   email => users.find(user => user.email === email),
   id => users.find(user => user.id === id)
)
  const users = []

//Datenbank
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database("./db/articles.db");
const dbRegister = new sqlite3.Database('./db/register.db');
const dbGuests = new sqlite3.Database('./db/shoutbox.db');

//App
app.set('view engine', 'ejs')
app.use('/public', express.static(process.cwd() + '/views'));
app.use(bodyparser.urlencoded({extended: false}));
app.use(bodyparser.json());
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

//Index
app.get('/',  async (req, res) => {
    db.all('SELECT * FROM articles ORDER BY rowid DESC', (err, articles) => {
        res.render('index', { articles : articles })
      });
})


app.get('/member', checkAuthenticated, async (req, res) => {
    db.all('SELECT * FROM articles ORDER BY rowid DESC', (err, articles) => {
        res.render('member', { articles : articles })
      });
})

//Login
app.get('/login', checkNotAuthenticated, (req, res) => {
    dbRegister.all("SELECT * from registerData", (err, rows) => { 
        if (err) {
          throw err
        }
        rows.forEach(entry=>{
            users.push({             
                id: entry.id, 
                name: entry.name,
                email: entry.email,
                password: entry.password
            
             })
        })
    })
  res.render('login.ejs')
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/member',
  failureRedirect: '/login',
  failureFlash: true
}))

//Register
app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register.ejs')
})

app.post('/register', checkNotAuthenticated, async (req, res) => {
    if(req.body.name && req.body.email && req.body.password && req.body.authentication==='secret'){
        //try {
            const hashedPassword = await bcryptjs.hash(req.body.password, 10)
            //users.push({
              //id: Date.now().toString(),
              //name: req.body.name,
              //email: req.body.email,
              //password: hashedPassword
            //})
            dbRegister.run('INSERT INTO registerData(id, name, email, password) VALUES (?, ?, ?, ?);', 
                [Date.now().toString(), req.body.name, req.body.email, hashedPassword], 
                (err) => {
                if(err) {
                   res.json({error: err});
                  
                } else {
                    res.redirect('/login') 
                }
            });
            
         //} catch {
           //  res.redirect('/register')
         //}
	}else{
     res.redirect('/register') 
     
	}
  
})

//Logout
app.delete('/logout', (req, res) => {
  req.logOut()
  res.redirect('/')
})

//Authentication
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }

  res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  next()
}
//Guests

app.get('/guests', checkNotAuthenticated, async (req, res) => {
  dbGuests.all('SELECT * FROM shouts', (err, shouts) => {
    res.render('guests.ejs', { shouts : shouts })
  });
})

app.get('/guests_member', checkAuthenticated, async (req, res) => {
  dbGuests.all('SELECT * FROM shouts', (err, shouts) => {
    res.render('guests_member.ejs', { shouts : shouts })
  });
})


app.post('/guests', (req, res) => {
    dbGuests.run('INSERT INTO shouts(username, message) VALUES (?, ?);', [req.body.username, req.body.message], function(err) {
      res.redirect("/guests")
    });
});


//Articles Routes

app.get('/articles/new', checkAuthenticated,(req, res) => {
    res.render('articles/new')
})

app.get ('/articles/member/:id',checkAuthenticated, async(req, res) => {
    const id = req.params.id
    db.all(`SELECT * FROM articles WHERE rowid =${id}`, (err, articles) => {
        res.render(`articles/show_member`,{ articles : articles })
      });
})

app.get ('/articles/:id',checkNotAuthenticated, async(req, res) => {
    const id = req.params.id
    db.all(`SELECT * FROM articles WHERE rowid =${id}`, (err, articles) => {
        res.render(`articles/show`,{ articles : articles })
      });
})

app.get ('/articles/edit/:id',checkAuthenticated, async(req, res) => {
    const id = req.params.id
    db.all(`SELECT * FROM articles WHERE rowid =${id}`, (err, articles) => {
        if(err){
          res.render("/")
        }else{
          res.render(`articles/edit`,{ articles : articles })
        }
      });
})


app.post('/articles',checkAuthenticated, async (req, res) => {
    
    if(req.body.title && req.body.description && req.body.content){
        const createdAt = new Date();
        db.run('INSERT INTO articles(title, description, content, createdAt) VALUES (?, ?, ?, ?)',[req.body.title, req.body.description, req.body.content, createdAt.toLocaleDateString()], function (err) {
            if(err) {
                console.log(err)
                res.render('articles/new')
            }else {
                let id = this.lastID;
                res.redirect(`articles/member/${id}`)
            }
        });
    }else{
        res.render('articles/new.ejs')
    } 
})

app.delete('/articles/:id', checkAuthenticated,async(req, res) => {
    const id = req.params.id
    db.run(`DELETE FROM articles WHERE rowid=${id}`, function(err) {
        if (err) {
          return console.error(err.message);
        }
        res.redirect('/member')
      });
})

app.delete('/remove_guests', checkAuthenticated,async(req, res) => {
  dbGuests.run(`DELETE FROM shouts WHERE rowid=?`,[req.body.id], function(err) {
      if (err) {
        return console.error(err.message);
      }
      res.redirect('/guests_member')
    });
})

app.put('/articles/:id', checkAuthenticated, async (req, res) => {
    const id = req.params.id
    db.run(`UPDATE articles SET title=?, description=?, content=? WHERE rowid=?`,[req.body.title, req.body.description, req.body.content, id], function(err) {
        if (err) {
          return console.error(err.message);
        }
        res.redirect(`/member`)
      });
})


app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});