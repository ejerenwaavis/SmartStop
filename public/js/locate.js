

function success(position) {
  console.log(position);
  const x = position.coords.latitude;
  const y = position.coords.longitude;
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

getGecode.then(success).catch(error);
