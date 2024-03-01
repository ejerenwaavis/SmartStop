function find(element) {
    const noResults = '<a class="dropdown-item text-center" href="#"><em>No match found, try suggesting an addition </em></a> '
    const keepTyping = '<a class="dropdown-item text-center" href="#"><em>Continue Typing to begin search... </em></a> '
    const searchPhrase = element.value;
    if (searchPhrase.length > 1) {
        $.get(domain+"/search/" + searchPhrase + "", (communities) => {
            if (communities) {
                console.log("found something");
                // console.log((JSON.stringify(communities)).replaceAll("'", "") );
                $("#resultList").html("");
                communities.map(community => {
                    var stringifiedCommunity = (JSON.stringify(community)).replaceAll("'", "");
                    // console.log(stringifiedCommunity);
                    $("#resultList").append('<a class="dropdown-item text-truncate"  data=\'' + stringifiedCommunity + '\' onclick="showCode(this)"><strong>' + community.communityName + '</strong>, ' + community.streets.join(', ') + '</a> ')
                });
            } else {
                $("#resultList").html(noResults)
            }

        });

    }else{
        $("#resultList").html(keepTyping)

    }
}

function showCode(element) {
    // $("#defaultCode").hide();
    var community = JSON.parse($(element).attr("data"));
    var searchedInfoHtml = "";
    for (gateCode of community.gateCodes) {
        var prefix = (gateCode.code.toString().length == 4 && gateCode.code.toString() !== "0000") ? "#" : "";
        searchedInfoHtml += '<p class="mb-0 mt-3"> ' + gateCode.description + ' </p> <h1 class="gate-code-font fw-bolder  mt-0 mb-0" id="label">' +
          ''+ prefix +''+   gateCode.code + '</h1>';
    }

    var defaultInfo = '<p class="mt-4 mb-0"> <em><b> '+  community.communityName + ' </b> Community</em></p>'+
      '<p class="mb-4 " id="gateCode-description"> <i>Streets inside: </i>' + community.streets.join(", ") + '</p>';

    // console.log(searchedInfoHtml);
    $("#adminStuff").hide();
    $("#defaultCode").hide();
    $("#serchedCode").html(searchedInfoHtml);
    $("#communityDescription").html(defaultInfo);
}

async function handletransferForm(evt){
    let searchPhrase = $("#search-field").val();
    console.log("search field is: ", searchPhrase);

    if(searchPhrase.length > 0){

        await $.get(domain+"/transferSearch/" + searchPhrase + "", async (communities) => {
            if (communities) {
               await communities.sort(function(a, b) {
                    var nameA = a.communityName.toUpperCase(); // ignore upper and lowercase
                    var nameB = b.communityName.toUpperCase(); // ignore upper and lowercase
                    if (nameA < nameB) {
                        return -1;
                    }
                    if (nameA > nameB) {
                        return 1;
                    }
                    // names must be equal
                    return 0;
                });

                console.log("found something");
                console.log(communities);
                
                $("#result-display").html("");
                communities.map(async community => {
                    let codesHtml = "";
                    await community.gateCodes.forEach(code => {
                        codesHtml = codesHtml + code.description + ": #" + code.code + " | "
                    });
                    let html = '<a href="#" onclick="handlePrintSelection(this)" class="list-group-item list-group-item-action " >'+
                                '<div class="d-flex w-100 justify-content-between">'+
                                '<h6 class="mb-1">'+community.communityName+'</h6>'+
                                '<small>'+community.city+'</small>'+
                                '</div>'+
                                '<p class="mb-1">'+ codesHtml +'</p>'+
                                '<small><i>Streets Inside: '+community.streets.join(', ')+' </i></small>'+
                                '</a>'
                    $("#result-display").append(html)
                });
            } else {
                $("#result-display").html("<p class='text-center'>Not Found</p>")
                console.log("found nothing");
            }
            
        });
    }else{
        console.log("Nothing to Search");
    }
}



function handlePrintSelection(evt){
    $(evt).toggleClass("d-print-none border-start border-2 border-danger opacity-50")
}