$(function(){
    // In order to make keyboard readonly, so that mobile 
    // keyboard doesn't pop up when using onscreen keyboard    
    $(".keyboard").hide();

    $('[data-toggle="tooltip"]').tooltip();
    
    var currentRequest = null;

    function triggerSearch() {
        $("#specific-results").fadeTo(200,0.1);

        var query = $("#search").val();

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
            timeout: 10000,
            beforeSend : function() {
                // Code to show loader      
                $('#results').html('<div class="d-flex justify-content-center"><div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div></div>');
                if(currentRequest != null) {
                    currentRequest.abort();
                }
            },
            success: function(data) {
                $('#results').html(data);
            },
            error:function(jqXHR, textStatus){
                if(textStatus === 'timeout')
                {     
                    console.log("Timed out while searching");
                    console.log("GET /searching?search=", query);
                    //do something. Try again perhaps?
                }
                if (textStatus !== 'abort') {
                    $('#results').html("Error occured, please try again in a while.");
                }
            }
        });
    }

    $('#search').on('focus', function(e) {
        // $(".homepage-container").animate({"margin-top": "0"}, "fast");
        $(".introduction").remove();

        if (e.key == 'Enter') {
            if ($("#dict-results-table > tbody:nth-child(2) > tr:nth-child(1) > td:nth-child(1) > a:nth-child(1)").length == 0) {
                console.warn("Enter pressed before results appeared");
                return;
            } else {
                window.location.href = $("#dict-results-table > tbody:nth-child(2) > tr:nth-child(1) > td:nth-child(1) > a:nth-child(1)")[0].href;
                $('#results').html('<div class="d-flex justify-content-center"><div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div></div>');
                return;
            }
        }
        triggerSearch();
    });

    $('span.KeyboardKey').on('click', function(e) {
        // $(".homepage-container").animate({"margin-top": "0"}, "fast");
        triggerSearch();
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
            // Enable the following two lines to collapse items when 
            // clicking on something not child of currently opened item
            // $this.parent().parent().find('li .inner').removeClass('show');
            // $this.parent().parent().find('li .inner').slideUp(350);
            
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

    $('#showtoggle').click(function(){ $('#answer').toggle(); return false; });

    $("input[name='options']").change(function() {
        var method = $("input[name='options']:checked").val();
        switch (method) {
            case "roman":
                $("#search").attr("placeholder", "type an english word or change input method");
                break;
            case "nagari":
                $("#search").attr("placeholder", "type to transliterate into konkani");
                break;
            case "keyboard":
                $("#search").attr("placeholder", "type using the onscreen keyboard");
                break;
        }
        
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
