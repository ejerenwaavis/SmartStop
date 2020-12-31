let x = 0;
let y = 0;

function success(position) {
  // console.log(position);
  x = position.coords.latitude;
  y = position.coords.longitude;
  $('#coord-x').text("Lat: " + x);
  $('#coord-y').text("Lon: " + y);
  $("#position").val(x + "," + y);
  $('#location-form').submit();
}


function error(error) {
  console.log(error);
  $('#coord-x').text(error);
  $('#coord-y').text(error);
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
  })
})


function includeCommunity(){
  $("#geoCodeForm").submit();
}



getGecode.then(success).catch(error);
