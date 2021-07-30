$("document").ready(function(){
  $("#accessForm").on("submit", function(e){
     e.preventDefault();
      includeCommunity();
  });

});

let x = 0;
let y = 0;
let geoPosition = 0;



function success(position) {
  geoPosition = position;
  // console.log(position);
  x = position.coords.latitude;
  y = position.coords.longitude;
  $('#coord-x').text("Lat: " + x);
  $('#coord-y').text("Lon: " + y);
  $("#position").val(x + "," + y);
  $('#location-form').submit();
}


function error(error) {
  // console.log(error);
  if (error.message === "User denied Geolocation") {
    $("#gpsError").text("Hmmm... It seems your location is turned off, try turning it on and then refresh the page.");
    console.log("User denied access to GeoLocation");
  }
}


const getGecode = new Promise(function(resolve,reject){
  navigator.geolocation.getCurrentPosition(function (position) {
    resolve(position);
  }, function(err){
    reject(err);
  },{
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
});
})

const getCurrentStreetName = new Promise(function (resolve,reject){
  const url='/resourceStreet';
  getGecode.then(function(position){
  let coords =   position.coords.latitude +","+ position.coords.longitude;
  const data = { position: coords }
    $.post(url,data,function(result){resolve(result);});
  }).catch(error)
})



/**************************  HAndling Admin Privilage Form****************************************/
function includeCommunity(){
  var adminPass = $("#adminPass").val().trim();

  if (adminPass) {
      $.post("/validatePassword", {password:adminPass},function(data){
        if(data === true){
          $("#geoCodeForm").submit();
        }else{
            focusOnAdminPass();
            $("#error-message").text("Access Denied - Invalid Password");
            $("#error-message").fadeIn("slow").fadeOut(3000);
          }

      });
  }else{
    $("#error-message").text("Access Denied - Password cannot be empty");
    $("#error-message").fadeIn("slow").fadeOut(3000);
    focusOnAdminPass();
  }
}


function submitGeoCodeForm(){
  console.log("submitting geocode form");
  $("#geoCodeForm").submit();
}

function focusOnAdminPass(){
  console.log("include clicked");
  $('#staticBackdrop').on('shown.bs.modal', function () {
      $('#adminPass').focus();
  });
}

getGecode.then(success).catch(error);
