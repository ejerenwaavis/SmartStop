function generateEmptyTextField(){
  const addressField =
  '<div class="input-group mb-2"> <input type="text" autofocus value="" class="mb-2 form-control street-address" id="" placeholder="Street Address">'+
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
    '<input type="text" value="'+value+'" class="mb-2 form-control street-address" id="" placeholder="Street Address">'+
  '</div>' +
'';
  return addressField;
}

function addAddressField(){
  const tempArrays = [];
  const streetAdresses = $('.street-address');
  for(address of streetAdresses){
    if(address.value){
      tempArrays.push(address.value);
    }
  }
  let fieldsHtml = constructAddressFieldHTML(tempArrays);
  $('.street-address-container').html(fieldsHtml);
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
  '<div class="input-group mb-2 col-lg-6">'+
    '<input type="text" autofocus class="form-control gate-code-description" placeholder="Gate Code Description" value="" aria-label="Example text with button addon" aria-describedby="button-addon1">'+
  '</div>'
  '<div class="input-group mb-2 col-lg-6">'+
    '<input type="text" class="form-control gate-code" placeholder="Gate Code #" value="" aria-label="Example text with button addon" aria-describedby="button-addon1">'+
    '<div class="input-group-append">'+
      '<button class="btn btn-outline-warning" type="button" onclick="addGateCodeField()" id="button-addon1"><i class="fas fa-plus"></i></button>'+
    '</div>'
  '</div>'+
'';
  return codeField;
}

function generateGateCodeField(gateCode){
  const codeField =''+
  '<div class="input-group mb-2 col-lg-6">'+
    '<input type="text" class="form-control gate-code-description" placeholder="Gate Code Description" value="'+gateCode.description+'" aria-label="Example text with button addon" aria-describedby="button-addon1">'+
  '</div>'
  '<div class="input-group mb-2 col-lg-6">'+
    '<input type="text" class="form-control gate-code" placeholder="Gate Code #" value="'+gateCode.code+'" aria-label="Example text with button addon" aria-describedby="button-addon1">'+
  '</div>'+
'';
  return codeField;
}

function addGateCodeField(){
  const tempArrays = [];
  const gateCodeDescription = $('.gate-code-description');
  const gateCodes = $('.gate-code');
  for(i=0; i<gateCodeDescription.length; i++){
    if(gateCodeDescription[i].value && gateCodes[i].value){
      tempArrays.push(new GateCode(gateCodeDescription[i].value, gateCodes[i].value));
    }
  }
  let gateCodeFieldsHtml = constructGateCodeFieldHTML(tempArrays);
  $('.gate-code-container').html(gateCodeFieldsHtml);
  // console.log(tempArrays);
}

function constructGateCodeFieldHTML(array){
  let htmlString = "";
  console.log(htmlString);
  for(i=0; i < array.length; i++){
    htmlString = htmlString + generateGateCodeField(array[i]);
  }
  htmlString = htmlString + generateEmptyGateCodeField();
  return htmlString;
}
