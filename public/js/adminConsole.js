$(document).ready(function(){
  $("#error-message").fadeOut(3500);
});

function reload(){
  location.reload();
}

function verifyUser(e){
  let password=prompt("Please Enter Console Password");
  if(password){
    $.post("/validateConsolePassword", {password:password},function(accessGranted){
      if(accessGranted){
        let userID = e.id;
        let evt = $("#"+userID);
        let body = {
            userID:userID,
        }
        $.post("/verifyUser", body, function(verified){
          if(verified){
            evt.addClass("btn-outline-success");
            evt.removeClass("btn-outline-danger");
            evt[0].outerHTML = '<span id="'+userID+'" onclick="restrictUser(this)" class="verify-btn btn btn-outline-success">Verified <i id="116847574837149673093" class="fas fa-user-check"></i></span>'
            // evt.html("Verified <i id='"+userID+"' class='fas fa-user-check'></i>");
            $("#message").text("User has been verified");
            $("#message").fadeIn("slow").fadeOut(3000);
          }else{
            $("#error-message").text("Unable to Verify User");
            $("#error-message").fadeIn("slow").fadeOut(3000);
          }
        });
      }else{
        $("#error-message").text("Invalid Console password");
        $("#error-message").fadeIn("slow").fadeOut(3000);
      }

    })
  }
}

function restrictUser(e){
  let password=prompt("Please Enter Console Password");
  if(password){
    $.post("/validateConsolePassword", {password:password},function(accessGranted){
      if(accessGranted){
        let userID = e.id;
        let evt = $("#"+userID);
        let body = {
            userID:userID,
        }

        $.post("/restrictUser", body, function(restricted){
          if(restricted){
            evt.addClass("btn-outline-danger").removeClass("btn-outline-success");
            evt[0].outerHTML = '<span id="'+userID+'" onclick="verifyUser(this)" class="verify-btn btn btn-outline-danger">Unverified <i id="'+userID+'" class="fas fa-user-times"></i></span>';
            // evt.html("Unverified <i id='"+userID+"' class='fas fa-user-times'></i>");
            $("#message").text("User has been Restricted");
            $("#message").fadeIn("slow").fadeOut(3000);
          }else{
            $("#error-message").text("Unable to Restrict User");
            $("#error-message").fadeIn("slow").fadeOut(3000);
          }
        });
      }else{
        $("#error-message").text("Invalid Console password");
        $("#error-message").fadeIn("slow").fadeOut(3000);
      }

    })
  }



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


/******************Handling adding multiple streets to comunity*****************************/
