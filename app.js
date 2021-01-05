require("dotenv").config();
const APIKEY = process.env.APIKEY;
const PASSWORD = process.env.PASSWORD;
const ADMINPASS = process.env.ADMINPASS;

const express = require("express");
const app = express();
const ejs = require("ejs");
const https = require("https");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");


app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));


const uri = "mongodb+srv://Admin-Avis:"+PASSWORD+"@db1.s2pl8.mongodb.net/auto-g-codes-0";
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String
});

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

const User = mongoose.model("User", userSchema);
const Community = mongoose.model("Community", communitySchema);



app.route("/")
  .get(function(req, res) {
    res.render("home", {
      body: new Body("G-Code", "", "")
    });
  })

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

app.route("/adminAdd")
  .get(function(req, res) {
    res.render("adminAdd", {
      body: new Body("G-code|Admin", "", ""),
      location: undefined
    });
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

    Community.exists({communityName: community.communityName}, function(err,exists){
      if(!exists){
        console.log("Nod duplicates found");
        community.save(function(err, savedDoc){
        if(!err){
          const communityResult = {
            streets: savedDoc.streets,
            communityName: savedDoc.communityName,
            gateCodes: savedDoc.gateCodes
          }
          res.render("home", {
            body: new Body("G-code", "", "Succesfully added with no duplicates " + savedDoc.communityName + " communityt"),
            community: communityResult
          });
        }else{
          res.render("code", {
            body: new Body("G-code|Admin", "Error: Failed to save the gate codes --> "+err, ""),
            location:community
          })
        }
      });
      }else{
        console.log("found duplicate");
        res.render("adminAdd", {
          body: new Body("G-code|Admin", "Community '"+ community.communityName +"', alread exists", ""),
          location:community
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

app.post("/resourceStreet", function(req,res){
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


app.route("/validatePassword")
.get(function(req,res){
  res.send(false);
})
.post(function(req,res){
    pass = req.body.password;
    if(pass === ADMINPASS){
      res.send(true);
    }else{
      res.send(false);
    }
  })

app.listen(process.env.PORT || 3000, function() {
  console.log("GCodes is Live");
})

function Body(title, error, message) {
  this.title = title;
  this.error = error;
  this.message = message;
}
