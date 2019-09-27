// define dependencies
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session'); 
const bcrypt = require("bcrypt");
const app = express();
const PORT = 3000; 

//connect to database
mongoose.connect('mongodb://localhost:27017/userDetails', {
    useNewUrlParser: true
  }).then(() => {
    console.log("Successfully connected to the database");    
  }).catch(err => {
    console.log('Could not connect to the database. Exiting now...', err);
    process.exit();
  });

// define database schemas
const User  = require('./models/user');

// configure bodyParser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(
    session({
      secret: "iy98hcbh489n38984y4h498", // don't put this into your code at production.  Try using saving it into environment variable or a config file.
      resave: true,
      saveUninitialized: false
    })
  );

  // User Sign up

  app.post('/signup', (req, res) => {
    let {firstName, lastName, email, password} = req.body; // this is called destructuring. We're extracting these variables and their values from 'req.body'
      
      let userData = {
          firstName,
          lastName,
          email,
          password: bcrypt.hashSync(password, 5) // we are using bcrypt to hash our password before saving it to the database
          
      };
      
      let newUser = new User(userData);
      newUser.save().then(error => {
          if (!error) {
              return res.status(201).json('signup successful')
          } else {
              if (error.code ===  11000) { // this error gets thrown only if similar user record already exist.
                  return res.status(409).send('user already exist!')
              } else {
                  console.log(JSON.stringigy(error, null, 2)); // you might want to do this to examine and trace where the problem is emanating from
                  return res.status(500).send('error signing up user')
              }
          }
      })
  })

  // User Sign In
 
  app.post('/login', (req, res) => {
    let {email, password} = req.body;
      User.findOne({email: email}, 'email password', (err, userData) => {
          if (!err) {
              let passwordCheck = bcrypt.compareSync(password, userData.password);
              if (passwordCheck) { // we are using bcrypt to check the password hash from db against the supplied password by user
                  req.session.user = {
                    email: userData.email,
                    id: userData._id
                  }; // saving some user's data into user's session
                  req.session.user.expires = new Date(
                    Date.now() + 3 * 24 * 3600 * 1000 // session expires in 3 days
                  )
                  res.status(200).send('You are logged in, Welcome!');
              } else {
                  res.status(401).send('incorrect password');
              }
          } else {
              res.status(401).send('invalid login credentials')
          }
      })
  })

  // Authorization

  app.use((req, res, next) => {
    if (req.session.user) {
      next();
    } else {
      res.status(401).send('Authrization failed! Please login');
    }
  });
  
  app.get('/protected', (req, res) => {
    res.send(`You are seeing this because you have a valid session.
          Your firstName is ${req.session.user.firstName} 
          and email is ${req.session.user.email}.
      `)
  })

  // Logout

  app.all('/logout', (req, res) => {
    delete req.session.user; // any of these works
        req.session.destroy(); // any of these works
      res.status(200).send('logout successful')
  })

  // Forgot Password

  app.post('/forgot', (req, res) => {
    let {email} = req.body; // same as let email = req.body.email
    User.findOne({email: email}, (err, userData) => {
      if (!err) {
        userData.passResetKey = shortid.generate();
        userData.passKeyExpires = new Date().getTime() + 20 * 60 * 1000 // pass reset key only valid for 20 minutes
        userData.save().then(err => {
            if (!err) {
              // configuring smtp transport machanism for password reset email
              let transporter = nodemailer.createTransport({
                service: "gmail",
                port: 465,
                auth: {
                  user: '', // your gmail address
                  pass: '' // your gmail password
                }
              });
              let mailOptions = {
                subject: `NodeAuthTuts | Password reset`,
                to: email,
                from: `NodeAuthTuts <yourEmail@gmail.com>`,
                html: `
                  <h1>Hi,</h1>
                  <h2>Here is your password reset key</h2>
                  <h2><code contenteditable="false" style="font-weight:200;font-size:1.5rem;padding:5px 10px; background: #EEEEEE; border:0">${passResetKey}</code></h4>
                  <p>Please ignore if you didn't try to reset your password on our platform</p>
                `
              };
              try {
                transporter.sendMail(mailOptions, (error, response) => {
                  if (error) {
                    console.log("error:\n", error, "\n");
                    res.status(500).send("could not send reset code");
                  } else {
                    console.log("email sent:\n", response);
                    res.status(200).send("Reset Code sent");
                  }
                });
              } catch (error) {
                console.log(error);
                res.status(500).send("could not sent reset code");
              }
            }
          })
      } else {
        res.status(400).send('email is incorrect');
      }
    })
  });

  // Reset Password

  app.post('/resetpass', (req, res) => {
    let {resetKey, newPassword} = req.body
      User.find({passResetKey: resetKey}, (err, userData) => {
          if (!err) {
              let now = new Date().getTime();
              let keyExpiration = userDate.passKeyExpires;
              if (keyExpiration > now) {
          userData.password = bcrypt.hashSync(newPassword, 5);
                  userData.passResetKey = null; // remove passResetKey from user's records
                  userData.keyExpiration = null;
                  userData.save().then(err => { // save the new changes
                      if (!err) {
                          res.status(200).send('Password reset successful')
                      } else {
                          res.status(500).send('error resetting your password')
                      }
                  })
              } else {
                  res.status(400).send('Sorry, pass key has expired. Please initiate the request for a new one');
              }
          } else {
              res.status(400).send('invalid pass key!');
          }
      })
  })
  
  

app.get('/', (req, res) => {
    res.send('Welcome to the Home of our APP');
  })
  
  app.get('/protected', (req, res) => {
    res.send('This page is protected. It requires authentication');
  })
  
  app.listen(PORT, () => {
    console.log(`app running port ${PORT}`)
  })
