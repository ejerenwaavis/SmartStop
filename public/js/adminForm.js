$(document).ready(function(){
  $("#error-message").fadeOut(3500);
});

let autocomplete;


function generateEmptyTextField(){
  const addressField =
  '<div class="input-group mb-2"> <input type="text" autofocus value="" class="mb-2 form-control street-address" id="autocomplete-address" placeholder="Street Addresses in the community">'+
    '<div class="input-group-append mb-2">' +
      '<button class="btn btn-outline-warning" onclick="addAddressField()" type="button" id="addAddress"><i class="fas fa-plus"></i></button>'+
    '</div>'+
  '</div>' +
'';
  return addressField;
}

function generateTextField(value){
  const addressField =
  '<div class="input-group mb-2">'+
    '<input type="text" value="'+value+'" class="mb-2 form-control street-address" id="'+value+'" placeholder="Street Addresses in the community">'+
  '</div>' +
'';
  return addressField;
}

function addAddressField(){
  getCurrentStreetName.then(function(newStreetName){
    const tempArrays = getAddressData();
    if(!(tempArrays.includes(newStreetName))){
      tempArrays.push(newStreetName);
    }
    let fieldsHtml = constructAddressFieldHTML(tempArrays);
    $('.street-address-container').html(fieldsHtml);
    initAutocomplete();
  });
}

function constructAddressFieldHTML(array){
  let htmlString = "";
  for(i=0; i < array.length; i++){
    htmlString = htmlString + generateTextField(array[i]);
  }
  htmlString = htmlString + generateEmptyTextField();
  return htmlString;
}




//*******************Gate Codes Input Field****************//

function GateCode(description, code){
  this.description = description;
  this.code = code;
}

function generateEmptyGateCodeField(){
  const codeField = ''+
  '<div class="input-group mb-2 col-6">'+
    '<input type="text" autofocus class="form-control gate-code-description" placeholder="Gate Code Description" value="" aria-label="Example text with button addon" aria-describedby="button-addon1">'+
  '</div>'+
  '<div class="input-group mb-2 col-6">'+
    '<input type="text" class="form-control gate-code" placeholder="Gate Code #" value="" aria-label="Example text with button addon" aria-describedby="button-addon1">'+
    '<div class="input-group-append">'+
      '<button class="btn btn-outline-warning" type="button" onclick="addGateCodeField()" id="button-addon1"><i class="fas fa-plus"></i></button>'+
    '</div>'+
  '</div>'+
'';
  return codeField;
}

function generateGateCodeField(gateCode){
  const codeField =''+
  '<div class="input-group mb-2 col-6">'+
    '<input type="text" class="form-control gate-code-description" placeholder="Gate Code Description" value="'+gateCode.description+'" aria-label="Example text with button addon" aria-describedby="button-addon1">'+
  '</div>'+
  '<div class="input-group mb-2 col-6">'+
    '<input type="text" class="form-control gate-code" placeholder="Gate Code #" value="'+gateCode.code+'" aria-label="Example text with button addon" aria-describedby="button-addon1">'+
  '</div>'+
  '';
  return codeField;
}

function addGateCodeField(){
  const tempArrays = getGaceCodesData(); //returns an array of gate code objects
  let gateCodeFieldsHtml = constructGateCodeFieldHTML(tempArrays);
  $('.gate-code-container').html(gateCodeFieldsHtml);
}

function constructGateCodeFieldHTML(array){
  let htmlString = "";
  for(i=0; i < array.length; i++){
    htmlString = htmlString + generateGateCodeField(array[i]);
  }
  htmlString = htmlString + generateEmptyGateCodeField();
  return htmlString;
}



//****************Handling Form data before submitiion************//
function sendForm(){
  let gateCodes = getGaceCodesData();
  let unFormattedStreets = getAddressData();
  let streets = [];

for (street of unFormattedStreets){
  streets.push(street.split(",",1)[0]);
}
  var gateCodesJSON = JSON.stringify(gateCodes);
  var streetsJSON = JSON.stringify(streets);

  $("#gate-code-JSON").val(gateCodesJSON);
  $("#streets-JSON").val(streetsJSON);


  if(gateCodes.length > 0 && streets.length > 0 && $('#communityName').val().trim().length > 2){
    // alert(streets);
    $("#add-community-form").submit();
    // console.log("Form Submited");
  }else{
    $("#error-message").text("Check that all neccessarry fields are supplied");
    $("#error-message").fadeIn(600).fadeOut(5000);
  }
}

function getGaceCodesData(){
  const tempArrays = [];
  const gateCodeDescriptions = $('.gate-code-description');
  const gateCodes = $('.gate-code');
  for(i=0; i<gateCodeDescriptions.length; i++){
    if(gateCodeDescriptions[i].value.trim() && gateCodes[i].value.trim()){
      tempArrays.push(new GateCode(gateCodeDescriptions[i].value, gateCodes[i].value.toString() ));
    }
  }
  return tempArrays;
}

function getAddressData(){
  const tempArrays = [];
  const streetAdresses = $('.street-address');
  let warningShown = false;

  for(address of streetAdresses){
    let newAddress = address.value.trim();
    newAddress = newAddress.split(",",1)[0];

    if(newAddress){
      // console.log(newAddress);
      let includes = (tempArrays.includes(newAddress));
      if(!includes){
        tempArrays.push(newAddress);
        // console.log(includes + ": Added " + tempArrays);
      }else{
        if(!warningShown){
          $('#error-message').text("AddAddress: Cannot add duplicate street name");
          $('#error-message').fadeIn().fadeOut(3000);
          // console.log("Street Already added");
          warningShown = true;
        }
      }
      // console.log();
    }else{
      $('#error-message').text("Street name cannot be empty");
      $('#error-message').fadeIn().fadeOut(3000);
      // console.log("Empty Street");
    }
  }

  // console.log("GetAddress => " + tempArrays);
  return tempArrays;
}


/************************** Address Auto complete ************************************************/

function initAutocomplete(){
  let inputs = $('.street-address');
  const options = {
    types: ['address']
  };


  for(input of inputs){
    autocomplete = new google.maps.places.Autocomplete(input, options);
    autocomplete.setFields(["address_components"]);
    autocomplete.addListener("place_changed", fillAddress);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        var geolocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        var circle = new google.maps.Circle(
            {center: geolocation, radius: position.coords.accuracy});
        autocomplete.setBounds(circle.getBounds());
      });
    }
  }
}

function fillAddress(){
  let place = autocomplete.getPlace();
  // console.log(place);
  if(place){
    let streetName = place.address_components[0].short_name;
    let city = place.address_components[1].short_name;
    let tempArrays = getAddressData();

    $('#autocomplete-address').val(streetName);
    $('#city').val(city);

  }

}

/******************Handling adding multiple streets to comunity*****************************/
