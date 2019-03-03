var sidebarOpen = false;

/* Set the width of the side navigation to 250px and the left margin of the page content to 250px and add a black background color to body */
/* function openNav() {
    document.getElementById("sidebar").style.width = "250px";
    document.getElementById("main").style.marginLeft = "250px";
    //document.body.style.backgroundColor = "rgba(0,0,0,0.4)";
    //document.getElementById("search").style.backgroundColor = "rgba(0,0,0,0.05)";
    document.sidebarOpen = true;
} */

/* Set the width of the side navigation to 0 and the left margin of the page content to 0, and the background color of body to white */
/* function closeNav() {
    document.getElementById("sidebar").style.width = "20px";
    document.getElementById("main").style.marginLeft = "0";
    //document.body.style.backgroundColor = "white";
    //document.getElementById("search").style.backgroundColor = "white";
    document.sidebarOpen = false;
} */

$(function(){
    // In order to make keyboard readonly, so that mobile 
    // keyboard doesn't pop up when using onscreen keyboard    
    $(".keyboard").hide();

    // collapseContents();
    $('.contents-accordion').find(".inner").slideUp(600);

    $('[data-toggle="tooltip"]').tooltip();
    
    var currentRequest = null;

    $('#search').on('keyup focus', function(e){
        // $(".homepage-container").animate({"margin-top": "0"}, "fast");

        $("#specific-results").fadeTo(200,0.1);

        var query = $(this).val();

        if (!query) {
            if(currentRequest != null) {
                currentRequest.abort();
            }
            $('#results').html("");
            return;
        }

        currentRequest = $.ajax({
            type: 'GET',
            data: 'search=' + query,
            url: '/searching',
            beforeSend : function()    {           
                if(currentRequest != null) {
                    currentRequest.abort();
                }
            },
            success: function(data) {
                $('#results').html(data);
            },
            error:function(e){
                $('#results').html("");
            }
        });
    });

    $("#search").focusout(function(e) {
        setTimeout(function() {
            var isKbActive = $(".keyboard").is(':active');
            var clickingOnResult = $("#results").is(':active');
            // Show specific results only if 
            // focus is not on keyboard
            // focus is outside the result box
            if (!isKbActive && !clickingOnResult) {
                $("#specific-results").fadeTo(0,1);
                // Clear results
                // $("#results").html("");
            }
        }, 100);
    });

    $('.contents-toggle').click(function(e) {
        if (e.target.href.startsWith("javascript"))
            e.preventDefault();
        else {
            window.open(e.target.href, '_blank');
            e.preventDefault();
        }
      
        var $this = $(this);
      
        if ($this.next().hasClass('show')) {
            $this.next().removeClass('show');
            $this.next().slideUp(350);
        } else {
            $this.parent().parent().find('li .inner').removeClass('show');
            $this.parent().parent().find('li .inner').slideUp(350);
            $this.next().toggleClass('show');
            $this.next().slideToggle(350);
        }
    });

    $('.counter-count').each(function () {
        $(this).prop('Counter',0).animate({
            Counter: $(this).text()
        }, {
            duration: 5000,
            easing: 'swing',
            step: function (now) {
                $(this).text(Math.ceil(now));
            }
        });
    });

    $('form.suggest-form .btn-primary').click(function(e) {
        e.preventDefault();
        if ($("div.form-group > textarea#suggestion").val() === '') {
            $("#suggestion").addClass("is-invalid");
            return false;
        } else {
            $("#suggestion").removeClass("is-invalid");
        }
        $.ajax({
            type: "POST",
            url: "/submit-suggestion",
            timeout: 10000,
            data: { name: $("div.form-group > input#name").val(),
                    email: $("div.form-group > input#email").val(),
                    suggestion: $("div.form-group > textarea#suggestion").val() 
                },
            beforeSend: function(jqXHR, settings) {
                $('form.suggest-form .btn-primary').html("Processing...");
                $('form.suggest-form .btn-primary').prop("disabled", true);
            },
            success: function(data) {
                //show content
                if (data.startsWith("250")) {// 250 message received
                    $('form.suggest-form .btn-primary').html("Submitted");
                    $('form.suggest-form .btn-primary').prop("disabled", true);
                    $($("#success-modal-trigger").attr("data-target")).modal("show");
                } else {
                    // Same as error
                    $('form.suggest-form .btn-primary').html("Submit");
                    $('form.suggest-form .btn-primary').prop("disabled", false);
                    $($("#failure-modal-trigger").attr("data-target")).modal("show");
                }
            },
            error: function(jqXHR, textStatus, err) {
                //show error message
                $('form.suggest-form .btn-primary').html("Submit");
                $('form.suggest-form .btn-primary').prop("disabled", false);
                $($("#failure-modal-trigger").attr("data-target")).modal("show");
            }
        });

        // Grey button while trying to send email
        // On success, turn button text into "Submitted"
    });

    $('body').on('click', '#home-button', function(e) {
        e.preventDefault();
        document.location.href="/";
    });

    $('body').on('click', '#retry-button', function(e) {
        e.preventDefault();
        window.open("mailto:mail@suryaashok.in?subject=Suggestion%20via%20website&body=" + encodeURI($(".suggest-form #suggestion").val()), '_blank');
    });
});

function onSceenKeyboard() {
    var isKbSelected = $("#opt-keyboard").is(":checked");
    var isMobile = window.matchMedia("only screen and (max-width: 760px)");
    var isKbVisible = $(".keyboard").is(':visible');

    if (isKbSelected && !isKbVisible) {
        if (isMobile.matches) {
            $("#search").attr('readonly', 'readonly');
        }
        $("#specific-results").fadeTo(0,0.05);
        $(".keyboard").show("slide");
    }

    if (!isKbSelected) {
        if (isMobile.matches) {
            $("#search").removeAttr('readonly').select();
        }
        $(".keyboard").hide("slide");
        $("#specific-results").fadeTo(0,1);
    }        

}