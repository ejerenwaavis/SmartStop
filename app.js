require("dotenv").config();
const APIKEY = process.env.APIKEY;

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


const uri = "mongodb+srv://Admin-Avis:Password123@db1.s2pl8.mongodb.net/auto-g-codes-0";
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
  gateCodes:[{  // array of gateCode Objects
    description:String,
    code:Number
  }]
});

const User = mongoose.model("User", userSchema);
const Community = mongoose.model("Community", communitySchema);



app.route("/")
  .get(function(req, res) {
    res.render("home", { body: new Body("G-Code", "", "")});
  })

app.route("/locate")
  .get(function(req,res){
    res.redirect("/");
  })
  .post(function(req, res) {
    const position = req.body.position;
    // console.log(position);
    const url = 'https://revgeocode.search.hereapi.com/v1/revgeocode?apiKey=' + APIKEY + '&at=' + position + '&lang=en-US'
    https.get(url, function(response) {
      response.on("data", function(data) {
        const location = JSON.parse(data).items[0].address;

        Community.find({},function(err, foundObj){
          if(!err){
            res.send(foundObj);
          }
        });

        // res.render("code", {body:new Body("G-Code","",""), location:location})
      });
    });
  })

app.route("/adminAdd")
  .get(function(req,res){
    res.render("adminAdd", {body:new Body("G-code|Admin","","")})
  })
  .post(function(req,res){
    let communityName = req.body.communityName;
    let strObj = JSON.parse(req.body.streetsJSON); //stringified array of stret names
    let gateCodesObj = JSON.parse(req.body.gateCodesJSON); // Stringified array of gateCode Objects being extracted to JSON

    console.log(gateCodesObj);

    const community = new Community({
      communityName: communityName,
      streets: strObj, //array of location objects
      gateCodes: gateCodesObj, // array of gateCode Objects
    });

    community.save(function(err, savedDoc){
      if(!err){
        res.send(savedDoc);
      }else{
        res.render("adminAdd", {body:new Body("G-code|Admin","Error: Failed to save the gate cdes","")})
      }
    });
  })



app.listen(process.env.PORT||3000, function() {
  console.log("GCodes is Live");
})

function Body(title, error, message) {
  this.title = title;
  this.error = error;
  this.message = message;
}
