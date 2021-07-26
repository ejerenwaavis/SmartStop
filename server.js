require("dotenv").config();
const APIKEY = process.env.APIKEY;
const ADMINPASS = process.env.ADMINPASS;
const ADMINCONSOLE = process.env.ADMINCONSOLE;
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRETE = process.env.CLIENT_SECRETE;
const PASSWORD = process.env.PASSWORD;
const SECRETE = process.env.SECRETE;
const SERVER = process.env.PORT;

const express = require("express");
const app = express();
const ejs = require("ejs");
const https = require("https");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const findOrCreate = require("mongoose-findorcreate");
const _ = require("lodash");


/*************** Authentication & Session Management ********************/
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;



app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));

//Forcing https so as to allow frontend geolocation work properly
/* app.use (function (req, res, next) {
//     // console.log(req.headers.host);
//         if (req.secure) {
//                 // request was via https, so do no special handling
//                 res.redirect('https://' + req.headers.host + req.url);
//         } else {
//                 // request was via http, so redirect to https
//                 res.redirect('https://' + req.headers.host + req.url);
//         }
// });
*/

/******************** Authentication Setup & Config *************/
//Authentication & Session Management Config
app.use(session({
  secret: SECRETE,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());



const uri = "mongodb+srv://Admin-Avis:" + PASSWORD + "@db1.s2pl8.mongodb.net/auto-g-codes-0";
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  username: String,
  _id: String,
  verified: { type: Boolean, default: false }
});
// Tell the User Schema to use the passportLocalMongoose plugin
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const communitySchema = new mongoose.Schema({
  communityName: String,
  streets: [String], //array of location objects
  city: String,
  stateCode: String,
  gateCodes: [{ // array of gateCode Objects
    description: String,
    code: String
  }]
});
// const allowedUserSchema = new mongoose.Schema({
//   googleId: String
// });

const User = mongoose.model("User", userSchema);
// const AllowedUser = mongoose.model("AllowedUser", allowedUserSchema);
const Community = mongoose.model("Community", communitySchema);


/********* Configure Passport **************/
passport.use(User.createStrategy());
//Serialize implementation
passport.serializeUser(function(user, done) {
  done(null, user);
});
//deserialize implementation
passport.deserializeUser(function(user, done) {
  done(null, user);
});

//telling passport to use GoogleStrategy
passport.use(new GoogleStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRETE,
    callbackURL: SERVER ? "https://auto-g-codes.herokuapp.com/loggedIn" : "/loggedIn",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    
  },
  function(accessToken, refreshToken, profile, cb) {
    let userProfile = profile._json;

    User.findOne({
      _id: userProfile.sub
    }, function(err, user) {
      console.log(err);
      if (!err) {
        console.log("userFOund---->:");
        console.log(user);
        if (user) {
            if (user.verified) {
              console.log("Logged In as: " + userProfile.name);
              return cb(null, user)
            } else {
              console.log("Logged in but Still Unauthorized");
              return cb(err);
            }
        } else {
          console.log("user not found - creating new user");
          let newUser = new User({
            username: userProfile.name,
            _id: userProfile.sub,
            verified: false
          })
          newUser.save()
            .then(function() {
              console.log("User Created Successfully");
              return cb(err);
            })
            .catch(function(err) {
              console.log("failed to create user");
              console.log(err);
            });
        }
      } else {
        console.log("Internal error");
        return cb(new Error(err))
      }
    });
  }
));



/**************************** Route aHandling ********************************/
app.route("/")
  .get(function(req, res) {
    
    if (req.isAuthenticated() || req.headers.host === "localhost:3000") {
      console.log("Authorised Request");
      res.render("home", {
        body: new Body("G-Code", "", "")
      });
    } else {
      console.log("UN-authenticated Request");
      res.redirect("/login");
    }
  })

app.route("/login")
  .get(function(req, res) {
    res.render("login", {
      body: new Body("Login", "", "")
    });
  })

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile']
}));

app.route("/loggedIn")
  .get(passport.authenticate('google', {
      failureRedirect: '/login'
    }),
    function(req, res) {
      // Successful authentication, redirect user page.
      // console.log("Logged IN");
      // console.log(user);
      // res.redirect("/");
      res.render('home', {
        body: new Body("G-Code", "", "Google Authentication Successful")
      });
    })


app.route("/logout")
  .get(function(req, res) {
    req.logout();
    console.log("Logged Out");
    res.redirect("/");
    // res.render("ho", {body:new Body("Login","","Logged out Successfully")})
  });

app.route("/locate")
  .get(function(req, res) {
    res.redirect("/");
  })
  .post(function(req, res) {
    const position = req.body.position;
    // console.log(position);
    const url = 'https://revgeocode.search.hereapi.com/v1/revgeocode?apiKey=' + APIKEY + '&at=' + position + '&lang=en-US'
    https.get(url, function(response) {
      response.on("data", function(data) {
        const location = JSON.parse(data).items[0].address;
        // Community.find({streets:location.street},function(err, foundObj){
        Community.find({
          streets: location.street
        }, function(err, foundObj) {
          if (!err) {
            if (foundObj[0]) {
              const communityResult = {
                streets: foundObj[0].streets,
                communityName: foundObj[0].communityName,
                gateCodes: foundObj[0].gateCodes
              }
              // res.send(foundObj);
              res.render("code", {
                body: new Body("G-Code", "", ""),
                community: communityResult,
                location: location
              })
            } else {
              const communityResult = {
                streets: [location.street],
                locationJSON: JSON.stringify(location),
                communityName: "Unregistered",
                gateCodes: []
              }
              // res.send(communityResult);
              res.render("code", {
                body: new Body("G-Code", "Unregistered Community", ""),
                community: communityResult,
                location: location
              });
            }
          } else {
            res.send("error");
          }
        });

      });
    });
  })

app.route("/search/:searchPhrase")
  .get(function (req, res) {
    const searchPhrase = _.startCase(_.toLower(req.params.searchPhrase));
    
    const searchRegex = "^"+searchPhrase+"";
    const re = new RegExp(searchRegex);
    // console.log(re);
    Community.find({ streets: { $regex: re } }, function (err, foundObj){
      if (!err) {
        console.log(foundObj);
        if (foundObj) {
          if (foundObj.length > 0){
            res.send(foundObj);
          }else{
            // res.send("Found Nothing: " + searchPhrase);
            res.send(null);
          }
        } else {
          // res.send("No Search Results for: " + searchPhrase);
          res.send(null);
        }
      } else {
        res.send("error: " + err);
      }
    });
    
    // Community.find({streets: searchPrase}, function (err, foundObj) {
    //   if(!err){
    //     if(foundObj.length > 0){
    //       res.send(foundObj);
    //     }else{
    //       res.send("No Search Results for: " + searchPrase);
    //     }
    //   }else{
    //     res.send("error: " + err);
    //   }
    // });


    // Article.find({ title_lower: title_lower }, function (err, docs) {
    //   if (!err) {
    //     if (docs.length > 0) {
    //       res.send(docs);
    //     } else {
    //       res.send("no such article")
    //       // res.send(err);
    //     }
    //   } else {
    //     res.send(err);
    //   }
    // })


  })


app.route("/adminAdd")
  .get(function(req, res) {
    res.redirect("/");
  })
  .post(function(req, res) {
    /*
        let communityName = req.body.communityName;
        let stateCode = req.body.stateCode;
        let city = req.body.city;
        let strObj = JSON.parse(req.body.streetsJSON); //stringified array of stret names
        let gateCodesObj = JSON.parse(req.body.gateCodesJSON); // Stringified array of gateCode Objects being extracted to JSON
    */

    const community = new Community({
      communityName: req.body.communityName,
      streets: JSON.parse(req.body.streetsJSON), //array of location objects
      city: req.body.city,
      stateCode: req.body.stateCode,
      gateCodes: JSON.parse(req.body.gateCodesJSON), // array of gateCode Objects
    });

    Community.exists({
      communityName: community.communityName
    }, function(err, exists) {
      if (!exists) {
        // console.log("No duplicates found");
        community.save(function(err, savedDoc) {
          if (!err) {
            const communityResult = {
              streets: savedDoc.streets,
              communityName: savedDoc.communityName,
              gateCodes: savedDoc.gateCodes
            }
            res.render("home", {
              body: new Body("G-code", "", "Succesfully added with no duplicates " + savedDoc.communityName + " communityt"),
              community: communityResult
            });
          } else {
            res.render("code", {
              body: new Body("G-code|Admin", "Error: Failed to save the gate codes --> " + err, ""),
              location: community
            })
          }
        });
      } else {
        console.log("found duplicate");
        res.render("adminAdd", {
          body: new Body("G-code|Admin", "Community '" + community.communityName + "', alread exists", ""),
          location: community
        });
      }
    });
    /*
        community.save(function(err, savedDoc) {
          if (!err) {
            // res.send(savedDoc);
            const communityResult = {
              streets: savedDoc.streets,
              communityName: savedDoc.communityName,
              gateCodes: savedDoc.gateCodes
            }
            res.render("home", {
              body: new Body("G-code", "", "Succesfully added " + savedDoc.communityName + " communityt"),
              community: communityResult
            });
          } else {
            res.render("adminAdd", {
              body: new Body("G-code|Admin", "Error: Failed to save the gate codes", "")
            })
          }
        });
        */

  })

app.post("/resourceStreet", function(req, res) {
  const position = req.body.position;
  // console.log("RESOURCE: " + position);
  const url = 'https://revgeocode.search.hereapi.com/v1/revgeocode?apiKey=' + APIKEY + '&at=' + position + '&lang=en-US'
  https.get(url, function(response) {
    response.on("data", function(data) {
      const location = JSON.parse(data).items[0].address;
      // console.log(location.street);
      res.send(location.street);
    });
  });
});

app.route("/adminInclude")
  .get(function(req, res) {
    res.redirect("/")
  })
  .post(function(req, res) {
    let location = JSON.parse(req.body.locationJSONString);
    // console.log(location);
    res.render("adminAdd", {
      body: new Body("G-code|Admin", "", ""),
      location: location
    })
  })

app.route("/adminConsole")
  .get(function(req, res) {
    User.find({}, function(err, foundUsers) {
      if (!err) {
        if (foundUsers) {
          res.render("adminConsole", {
            body: new Body("Admin Console", "", ""),
            users: foundUsers
          });
        } else {
          res.render("adminConsole", {
            body: new Body("Admin Console", "No Users Found", ""),
            users: undefined
          });
        }
      } else {
        res.render("adminConsole", {
          body: new Body("Admin Console", "Unable to Search the database", ""),
          users: undefined
        });
      }
    });
  })

app.route("/verifyUser")
  .post(function(req,res){
    let id = req.body.userID;
    console.log(id);
    User.updateOne({_id:id}, { verified: true },function(err,updated){
      if(updated.n > 0){
        res.send(true);
      }else{
        console.log(err);
        res.send(false);
      }
    })
  })

  app.route("/restrictUser")
    .post(function(req,res){
      let id = req.body.userID;
      console.log(id);
      User.updateOne({_id:id}, { verified: false },function(err,updated){
        if(updated.n > 0){
          res.send(true);
        }else{
          console.log(err);
          res.send(false);
        }
      })
    })

app.route("/validatePassword")
  .get(function(req, res) {
    res.send(false);
  })
  .post(function(req, res) {
    pass = req.body.password;
    if (pass === ADMINPASS) {
      res.send(true);
    } else {
      res.send(false);
    }
  })

  app.route("/validateConsolePassword")
    .get(function(req, res) {
      res.send(false);
    })
    .post(function(req, res) {
      pass = req.body.password;
      // console.log(pass);
      if (pass === ADMINCONSOLE) {
        res.send(true);
      } else {
        res.send(false);
      }
    })

app.listen(process.env.PORT || 3000, function() {
  console.log("GCodes is Live");
})



/*******************functionalities********************/
function allowedUser(userID) {

}

function Body(title, error, message) {
  this.title = title;
  this.error = error;
  this.message = message;
}