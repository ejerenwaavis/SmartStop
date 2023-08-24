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
        searchedInfoHtml += '<p class="mb-0 mt-3"> ' + gateCode.description + ' </p> <p class=" display-2 fw-bolder mt-0 mb-0" id="label">' +
          ''+ prefix +''+   gateCode.code + '</p>';
    }

    var defaultInfo = '<p class="mt-4 mb-0"> <em><b> '+  community.communityName + ' </b> Community</em></p>'+
      '<p class="mb-4 " id="gateCode-description"> <i>Streets inside: </i>' + community.streets.join(", ") + '</p>';

    // console.log(searchedInfoHtml);
    $("#adminStuff").hide();
    $("#defaultCode").hide();
    $("#serchedCode").html(searchedInfoHtml);
    $("#communityDescription").html(defaultInfo);
}

