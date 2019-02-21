// You may change this file as per your need
// Callback function which gets called when user presses F9 key.
function languageChangeCallback(data) {
	// Change the dropdown to new selected language.
	if (data.language === 'english') {
		// selected language is english so disable the buttons
		$("#showHelp, #showSettings").attr('disabled', 'disabled');
	} else {
		
		$("#showHelp").removeAttr('disabled');
		
		$("#showSettings").removeAttr('disabled');

		// change help image
		$("#pramukhimecharmap").attr('src', 'img/' + pramukhIME.getHelpImage());
		// changed detailed help
		$("#pramukhimehelpdetailed").attr('src', 'help/' + pramukhIME.getHelp());

		// Update UI
		updateSettingsUi();
		
		// save settings
		saveSettings();
	}
	$("#showHelp i").removeClass().addClass("pi-" + data.kb + '-' + data.language + '-help');
	$("#showSettings i").removeClass().addClass("pi-" + data.kb + '-' + data.language + '-settings');
	$("#toggleLang i").removeClass().addClass("pi-" + data.lastKb + '-' + data.lastLanguage);
	// Set the dropdown list value
	$("#drpLanguage").val(data.kb + ':' + data.language);

	// Update the shortcut key
	var kblang = data.lastKb + ':' + data.lastLanguage, items, value;
	$('#drpLanguage > option').each(function() {
		if (this.value === kblang) {
			value = pramukhime_lang[data.lastKb][data.lastLanguage];
			this.text = value + ' (F9)'; 
			
		} else {
			items = this.value.split(':');
			this.text = pramukhime_lang[items[0]][items[1]];
		}
	});
}

function updateSettingsUi() {
	// Update settings dialog
	var current_settings = pramukhIME.getSetting();
	// if no advanced rules available
	if (current_settings[1].advancedRuleValues) {
		if (current_settings[1].advancedRuleValues.length === 0) {
			$('#typingrulesection').hide();
		} else {
			$('#typingrulesection').show();
			$('#typingrules').val(current_settings[1].advancedRule);
		}
	}
	$('#digitinenglish')[0].checked = current_settings[0].digitInEnglish;
	var lang = pramukhIME.getLanguage();
	if (lang.language !== 'english') {
		// Set settings dialog title
		$('#typingruletitle').html(pramukhime_lang[lang.kb][lang.language] + " Settings");
	}
	

}

// save settings into cookie
function saveSettings() {
	if (typeof Storage === 'undefined' || typeof localStorage === 'undefined') {
		return;
	}
	// 400 represents the version number
	var pramukhime_settings = jQuery.parseJSON(localStorage.getItem('pramukhime_settings_400')) || { 'settings': {}, 'selectedLanguage': {} };
	// Get the current settings for the selected language
	var current_settings = pramukhIME.getSettings();
	// overwrite stored settings with the new settings
	pramukhime_settings.settings = current_settings;
	pramukhime_settings.selectedLanguage = pramukhIME.getLanguage();
	localStorage.setItem('pramukhime_settings_400', JSON.stringify(pramukhime_settings));
}

function setupInitialSettings() {
	if (typeof Storage === 'undefined' || typeof localStorage === 'undefined') {
		return;
	}
	var pramukhime_settings = jQuery.parseJSON(localStorage.getItem('pramukhime_settings_400'));
	if (pramukhime_settings === null || typeof pramukhime_settings === 'undefined') {
		return;
	}
	
	pramukhIME.setSettings(pramukhime_settings.settings);
	
	pramukhIME.setLanguage(pramukhime_settings.selectedLanguage.language, pramukhime_settings.selectedLanguage.kb);
	updateSettingsUi();
}

function resetSettings() {
	if (typeof Storage === 'undefined' || typeof localStorage === 'undefined') {
		// don't do anything
	} else {
		localStorage.removeItem('pramukhime_settings_400');
	}
	// reset the settings
	pramukhIME.resetSettings();
	// Update settings ui
	updateSettingsUi();
}

// Changing the language by selecting from dropdown list
function changeLanguage(newLanguage) {
	if (!newLanguage || newLanguage === "")
		newLanguage = 'pramukhime:english';
	// set new script
	var lang = newLanguage.split(':');
	pramukhIME.setLanguage(lang[1], lang[0]);
}
