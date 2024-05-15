const SERVER = !(process.execPath.includes("C:"));//process.env.PORT;
if (!SERVER){
  // console.error(SERVER);
  require("dotenv").config();
}

const APIKEY = process.env.APIKEY;
const ADMINPASS = process.env.ADMINPASS;
const ADMINCONSOLE = process.env.ADMINCONSOLE;
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRETE = process.env.CLIENT_SECRETE;
const PASSWORD = process.env.PASSWORD;
const SECRETE = process.env.SECRETE;

/*********Handling Server / Local Enviromnemnt sensitive variables************/
const APP_DIRECTORY = !(SERVER) ? "" : ((process.env.APP_DIRECTORY) ? (process.env.APP_DIRECTORY) : "");
const PUBLIC_FOLDER = (SERVER) ? "./" : "../";

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


// app.use( express.static('public'));

// Configure app to user EJS abd bodyParser
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));
// app.use(express.static(APP_DIRECTORY+"/public"));
// app.use(express.static("."));
// app.use(express.json()); 




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
  useUnifiedTopology: true,
  useFindAndModify: false
});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  _id: String,
  username: String,
  verified: { type: Boolean, default: false },
  firstName: String,
  lastName: { type: String, default: "" },
  password: { type: String, default: "" },
  photoURL: String,
  userHasPassword: {
    type: Boolean,
    default: false
  },
  email: { type: String, default: "" },
  approvalNotes:[{description:String, adminEmail: { type: String, default: "" }, adminUsername:String, date:Date}],
  verified: { type: Boolean, default: false },
  isProUser: { type: Boolean, default: false },
  renews: { type: Date, default: new Date() },
  usageCount: { type: Number, default: 0 },
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
    callbackURL: (SERVER ? "https://triumphcourier.com" : "" ) + APP_DIRECTORY+"/loggedIn",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    
  },
  function(accessToken, refreshToken, profile, cb) {
    let userProfile = profile._json;
    // console.error(userProfile);
    // console.error("Logged In as: " + userProfile.email + "\n" + userProfile.family_name +"\n" +userProfile.given_name+
    // "\n" +userProfile.name+ "\n" + userProfile.picture);
    // console.error("\n");
    User.findOne({_id: userProfile.sub 
    }, function(err, user) {
      if (!err) {
        let oldUser = user;
        let newUser={};
        // console.error("userFound---->:");
        // console.error(user);
        // console.error("----->:\n");
        
        if (user) {
          if((!user.username) && userProfile.name){
            // console.error("user has no USERNAME on file");
            newUser.username = userProfile.name;
          }
          if((!user.lastName) && userProfile.family_name){
            // console.error("user has no LAST NAME on file");
            newUser.lastName = userProfile.family_name;
          }

          if((!user.firstName) && userProfile.given_name){
            // console.error("user has no FIRST NAME on file");
            newUser.firstName = userProfile.given_name;
          }

          if((!user.photoURL) && userProfile.picture){
            // console.error("user has no PHOTO on file");
            newUser.photoURL = userProfile.picture;
          }

          if(!user.email && userProfile.email){
            // console.error("user has no EMAIL on file");
            newUser.email = userProfile.email;
          }

          // console.error(user);
          // console.error(newUser);

          if(oldUser === newUser){
            console.error("OldUser is equals NewUser no need for update");
            if (user.verified) {
              return cb(null, user)
            } else {
              console.error("Logged in but Still Unauthorized");
              return cb(err);
            }
          }else{
            
              User.findOneAndUpdate({_id:user._id}, newUser, {new:true, upsert:true})
              .then(function(result) {
                // console.error(result);
                console.error(user.firstName + " - " + (user.email? user.email:user._id)+ " : User Updates ran Successfully");
                return cb(null, user);
              })
              .catch(function(err) {
                console.error("failed to create user");
                console.error(err);
            });
          }
        } else {
          console.error("user not found - creating new user");
          let newID; 
          let newUser;
          if(/^\d+$/.test(userProfile.sub)){
            newID = userProfile.sub;
              console.error("Creating user with a valid _ID");
            newUser = new User({
              _id: userProfile.sub,
              email: userProfile.email,
              username: userProfile.name,
              firstName: userProfile.given_name,
              lastName: userProfile.family_name,
              verified: false,
              isProUser: false,
              photoURL: userProfile.picture
              });
            }else{
              console.error("Creating user w/o _ID");
              newUser = new User({
              email: userProfile.name,
              username: userProfile.given_name + " " + userProfile.family_name,
              firstName: userProfile.given_name,
              lastName: userProfile.family_name,
              verified: false,
              isProUser: false,
              photoURL: userProfile.picture
              })
            }


          newUser.save()
            .then(function() {
              console.error("User Created Successfully");
              return cb(err);
            })
            .catch(function(err) {
              console.error("failed to create user");
              console.error(err);
            });
        }
      } else {
        console.error("Internal error");
        return cb(new Error(err))
      }
    });
  }
));



/**************************** Route aHandling ********************************/
app.route(APP_DIRECTORY+"/")
  .get(function(req, res) {
    // if (req.isAuthenticated() || req.headers.host === "localhost:3000") {
    if (req.isAuthenticated()){
      if(req.user.verified){
        res.render("home", {
          body: new Body("SmartStop", "", "", APP_DIRECTORY),
          user: req.user
        });
      }else{
        console.error(new Date().toLocaleString() + " -- UnVerified User Access: " + ((req.user.email)? req.user.email:(req.user.firstName)) );
        res.render("login", {
          body: new Body("SmartStop", "Unauthorized Access, please request access from a Team lead.", "", APP_DIRECTORY),
          user: req.user
        });
      }
    } else {
      console.error("UN-authenticated Request");
      res.redirect(APP_DIRECTORY+"/login");
    }
  })

app.route(APP_DIRECTORY+"/login")
.get(function(req, res) {
    res.render("login", {
      body: new Body("Login", "", "", APP_DIRECTORY),
      user: null
    });
  })

app.get(APP_DIRECTORY+'/auth/google', passport.authenticate('google', {
    scope: [
    'profile',
    'email',
    // 'openid',
    // 'https://www.googleapis.com/auth/userinfo.profile',
    // 'https://www.googleapis.com/auth/userinfo.email'
  ]
})
);

app.route(APP_DIRECTORY+"/loggedIn")
  .get(passport.authenticate('google', {
      failureRedirect: APP_DIRECTORY+'/login'
    }),
    function(req, res) {
      if(req.user.verified){
        res.render("home", {
          body: new Body("SmartStop", "", "SmartStop Authentication Successful", APP_DIRECTORY),
          user: req.user
        });
      }else{
        console.error(new Date().toLocaleString() + " -- UnVerified User Access: " + ((req.user.email)? req.user.email:(req.user.firstName)) );
        res.render("login", {
          body: new Body("SmartStop", "Unauthorized Access, please request access from a Team lead.", "", APP_DIRECTORY),
          user: req.user
        });
      }
      // res.render('home', {
      //   body: new Body("SmartStop", "", "SmartStop Authentication Successful", APP_DIRECTORY),
      //   user: req.user,
      // });
    })


app.route(APP_DIRECTORY+"/logout")
  .get(function(req, res) {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect(APP_DIRECTORY + "/");
    });
  });

app.route(APP_DIRECTORY+"/locate")
  .get(function(req, res) {
    res.redirect(APP_DIRECTORY+"/");
  })
  .post(function(req, res) {
    const position = req.body.position;
    // console.error(position);
    const url = 'https://revgeocode.search.hereapi.com/v1/revgeocode?apiKey=' + APIKEY + '&at=' + position + '&lang=en-US'
    var location = {street:""};
    https.get(url, function(response) {
      response.on("data", function(data) {
        if(data?.items){
          console.log("Data Sent is: ");
          console.log(data);
          location = JSON.parse(data).items[0].address;
        }
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
                body: new Body("SmartStop", "", "", APP_DIRECTORY),
                user: req.user,
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
                body: new Body("SmartStop", "Unregistered Community", "", APP_DIRECTORY),
                user: req.user,
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

app.route(APP_DIRECTORY+"/search/:searchPhrase")
  .get(function (req, res) {
    const searchPhrase = _.startCase(_.toLower(req.params.searchPhrase));
    
    const searchRegex = "^"+searchPhrase+"";
    const re = new RegExp(searchRegex);
    // console.error(re);
    Community.find({$or: [{streets: { $regex: re }}, {communityName:{ $regex: re }}] }, function (err, foundObj){
      if (!err) {
        // console.error(foundObj);
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
  })



  app.route(APP_DIRECTORY+"/transferSearch/:searchPhrase")
  .get(function (req, res) {
    const searchPhrase = _.startCase(_.toLower(req.params.searchPhrase));
    
    const searchRegex = "^"+searchPhrase+"";
    const re = new RegExp(searchRegex);
    // console.error(re);
    Community.find({$or: [{city: { $regex: re }}] }, function (err, foundObj){
      if (!err) {
        // console.error(foundObj);
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
  })


app.route(APP_DIRECTORY+"/adminAdd")
  .get(function(req, res) {
    res.redirect(APP_DIRECTORY+"/");
  })
  .post(function(req, res) {

    // console.error(req.body.password);
    const community = new Community({
      communityName: (req.body.communityName.trim()) ? req.body.communityName.trim() : "-- Missing Name --" ,
      streets: JSON.parse(req.body.streetsJSON), //array of location objects
      city: req.body.city.trim(),
      stateCode: req.body.stateCode.trim(),
      gateCodes: JSON.parse(req.body.gateCodesJSON), // array of gateCode Objects
    });

    if (req.body.password === ADMINPASS){
      // console.error("Admin Pass Confirmed");
      Community.exists({
        communityName: community.communityName
      }, function(err, exists) {
        if (!exists) {
          // console.error("No duplicates found");
          community.save(function(err, savedDoc) {
            if (!err) {
              const communityResult = {
                streets: savedDoc.streets,
                communityName: savedDoc.communityName,
                gateCodes: savedDoc.gateCodes
              }
              res.render("home", {
                body: new Body("Admin Add", "", "Succesfully added with no duplicates " + savedDoc.communityName + " communitY", APP_DIRECTORY),
                user: req.user,
                community: communityResult
              });
            } else {
              res.render("code", {
                body: new Body("Admin Add", "Error: Failed to save the gate codes --> " + err, "", APP_DIRECTORY),
                user: req.user,
                location: community
              })
            }
          });
        } else {
          console.error("found duplicate");
          // console.error(community.streets);
          Community.findOneAndUpdate({ communityName: community.communityName }, 
            { $addToSet: { streets: { $each: community.streets }, gateCodes: { $each: community.gateCodes } }, },
            function(err, update){
              if(!err){
                res.render("adminAdd", {
                  body: new Body("Admin", "", "Community '" + community.communityName + "', was updated successfully", APP_DIRECTORY),
                  user: req.user,
                  location: null
                });
              }else{
                console.error("Encountered error: ");
                console.error(err);
                // console.error(exists);
                res.render("adminAdd", {
                  body: new Body("SmartStop|Admin", "Error: "+err.message, "", APP_DIRECTORY),
                  user: req.user,
                  location: community
                });
              }
            });
          
          
        }
      });
    }else{
      console.error("No Admin Password");
      res.render("adminAdd", {
        body: new Body("Admin Add", "Error: Invalid Passord", APP_DIRECTORY),
        user: req.user,
        location: community
      });
    }
  })

app.post(APP_DIRECTORY+"/resourceStreet", function(req, res) {
  const position = req.body.position;
  // console.error("RESOURCE: " + position);
  const url = 'https://revgeocode.search.hereapi.com/v1/revgeocode?apiKey=' + APIKEY + '&at=' + position + '&lang=en-US'
  
  https.get(url, function(response) {
    response.on("data", function(data) {
      const location = {street:""}
      if((data)?.items){
        console.log(data);
        location = JSON.parse(data).items[0].address;
        res.send(location.street);
      }else{
        res.send(location.street);
      }
      // console.error(location.street);
    });
  });
});

app.route(APP_DIRECTORY+"/adminInclude")
  .get(function(req, res) {
    // res.redirect(APP_DIRECTORY+"/") original code
    res.render("adminAdd", {
      body: new Body("SmartStop|Admin", "", "", APP_DIRECTORY),
      user: req.user,
      location: null
    })
  })
  .post(function(req, res) {
    let location = JSON.parse(req.body.locationJSONString);
    // console.error(location);
    res.render("adminAdd", {
      body: new Body("SmartStop|Admin", "", "", APP_DIRECTORY),
      user: req.user,
      location: location
    })
  })




app.route(APP_DIRECTORY+"/adminConsole")
  .get(function(req, res) {
    if (req.isAuthenticated() ) {
      // if(req.user?(req.user.isProUser):false || req.headers.host === "localhost:3000"){
      if(req.user.isProUser){
        User.find({}, function(err, foundUsers) {
          if (!err) {
            if (foundUsers) {
              res.render("adminConsole", {
                body: new Body("Admin Console", "", "", APP_DIRECTORY),
                user: req.user,
                users: foundUsers
              });
            } else {
              res.render("adminConsole", {
                body: new Body("Admin Console", "No Users Found", "", APP_DIRECTORY),
                user: req.user,
                users: undefined
              });
            }
          } else {
            res.render("adminConsole", {
              body: new Body("Admin Console", "Unable to Search the database", "", APP_DIRECTORY),
              user: req.user,
              users: undefined
            });
          }
       });
      }else{
        console.error("Require Priviledge Requirments Not Met");
        res.redirect(APP_DIRECTORY+"/");
      }
    }else{
      console.error("UN-authenticated Request");
      res.redirect(APP_DIRECTORY+"/login");
    } 
  })


app.route(APP_DIRECTORY+"/transfer")
  .get(function(req, res) {
    if (req.isAuthenticated() ) {
      // if(req.user?(req.user.isProUser):false || req.headers.host === "localhost:3000"){
      if(req.user.isProUser){
              res.render("transfer", {
                body: new Body("Transfer", "", "", APP_DIRECTORY),
                user: req.user,
              });
      }else{
        console.error("Require Priviledge Requirments Not Met");
        res.redirect(APP_DIRECTORY+"/");
      }
    }else{
      console.error("UN-authenticated Request");
      res.redirect(APP_DIRECTORY+"/login");
    } 
  })




app.route(APP_DIRECTORY+"/verifyUser")
  .post(function(req,res){
    let id = req.body.userID;
    // approvalNotes:[{description:String, adminUsername:String, date:Date}]
    User.updateOne({_id:id}, { verified: true,  $push: { approvalNotes: {description:"Verified", adminUsername:req.user.username, adminEmail:req.user.email, date:new Date()} }},function(err,updated){
      if(updated.n > 0){
        console.error("user verification Succesful: "+id);
        res.send(true);
      }else{
        console.error(err);
        res.send(false);
      }
    })
  })

app.route(APP_DIRECTORY+"/restrictUser")
  .post(function(req,res){
    let id = req.body.userID;
    // console.error(id);
    User.updateOne({_id:id}, { verified: false, $push: { approvalNotes: {description:"Restricted", adminUsername:req.user.username, adminEmail:req.user.email, date:new Date()} }},function(err,updated){
      if(updated.n > 0){
        res.send(true);
      }else{
        console.error(err);
        res.send(false);
      }
    })
  });

app.route(APP_DIRECTORY+"/makeProUser")
  .post(function(req,res){
    // console.error("");
    let id = req.body.userID;
    console.error(id);
    User.updateOne({_id:id}, { isProUser: true,  $push: { approvalNotes: {description:"Upgraded to ProUser", adminUsername:req.user.username, adminEmail:req.user.email, date:new Date()} } },function(err,updated){
      if(updated.n > 0){
        res.send(true);
      }else{
        console.error(err);
        res.send(false);
      }
    })
  });

app.route(APP_DIRECTORY+"/revokeProUser")
  .post(function(req,res){
    let id = req.body.userID;
    // console.error(id);
    User.updateOne({_id:id}, { isProUser: false, $push: { approvalNotes: {description:"Revoked ProUser Priviledges", adminUsername:req.user.username, adminEmail:req.user.email, date:new Date()} } },function(err,updated){
      if(updated.n > 0){
        res.send(true);
      }else{
        console.error(err);
        res.send(false);
      }
    })
  })

  app.route(APP_DIRECTORY+"/deleteUser")
  .post(function(req,res){
    let id = req.body.userID;
    // console.error(id);
    User.deleteOne({_id:id},function(err,deleted){
      // console.error(err);
      // console.error(deleted);
      if(deleted.deletedCount > 0){
        res.send(true);
      }else{
        console.error(err);
        res.send(false);
      }
    })
  })


app.route(APP_DIRECTORY+"/validatePassword")
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

app.route(APP_DIRECTORY+"/validateConsolePassword")
  .get(function(req, res) {
    res.send(false);
  })
  .post(function(req, res) {
    pass = req.body.password;
    // console.error(pass);
    if (pass === ADMINCONSOLE) {
      res.send(true);
    } else {
      res.send(false);
    }
  })

app.listen(process.env.PORT || 3000, function() {
  console.error(new Date().toLocaleString() + " -- SmartStop is live on port " + ((process.env.PORT) ? process.env.PORT : 3000));
})



/*******************functionalities********************/
function allowedUser(userID) {

}

function Body(title, error, message, appDir) {
  this.title = title;
  this.error = error;
  this.message = message;
  this.domain = appDir;
  this.publicFolder = PUBLIC_FOLDER;
}

