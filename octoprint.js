'use strict'

var request = require('request');

function OP(url, key) {
    this.URL = url;
    this.AUTH_KEY = key;
}

// template functions
function octoprintRequest(OP, method, apiPath, commandBody, onError, onSuccess) {
    console.log("OCTO_ENTERED_octoprintRequest");
    console.log('OP.URL', OP.URL);
    console.log('OP.AUTH_KEY', OP.AUTH_KEY);

    // form request settings
    var requestSettings = octoprintRequestSettings(OP.URL, OP.AUTH_KEY, method, apiPath, commandBody);

    console.log("OCTO_REQUEST_SETTINGS", requestSettings);

    // send the request
    request(requestSettings,
        function (error, response, body) {
            if (!error && response.statusCode >= 200 && response.statusCode < 300) {
                if (body) {
                    var receivedData = JSON.parse(body);

                    console.log("OCTO_RECEIVED => ", receivedData);
                    onSuccess(receivedData);
                }
                else {
                    console.log("OCTO_COMPLETED => EMPTY RESPONSE");
                    onSuccess();
                }
            }
            else if (response.statusCode >= 400 && response.statusCode < 500) {
                console.log(`OCTO_${response.statusCode} => `, error, body);
                var errMsg = '';

                if (response.statusCode == 401) errMsg = "Invalid OctoPrint key";
                else if (response.statusCode == 409) errMsg = "OctoPrint prevented this action, because of a conflict";

                onError({
                    statusCode: response.statusCode,
                    data: body,
                    error: error,
                    errMsg: errMsg
                });
            }
            else {
                console.log(`OCTO_FAILED_${response.statusCode} => `, error);
                console.log("OCTO_FAILED_USER_DATA => ", OP.USER_DATA);
                console.log("OCTO_FAILED_REQUEST - ", requestSettings);

                onError({
                    statusCode: response.statusCode,
                    data: body,
                    error: error,
                    errMsg: errMsg
                });
            }
        }
    );
}

// Direct gets
OP.prototype.getOctoprintVersion = function (onError, onSuccess) {
    octoprintRequest(this, "GET", "/api/version", null, onError,
        (data) => { onSuccess(data); }
    );
};

OP.prototype.getCurrentJobState = function (onError, onSuccess) {
    octoprintRequest(this, "GET", "/api/job", null, onError,
        (data) => { onSuccess(data); }
    );
};

OP.prototype.getCurrentTemperatures = function (onError, onSuccess) {
    octoprintRequest(this, "GET", "/api/printer?exclude=sd,state", null, onError,
        (data) => { onSuccess(data); }
    );
};

// Checks if the printer is printing, returns true/false
OP.prototype.checkIfPrinterIsPrinting = function (onError, onSuccess) {
    octoprintRequest(this, "GET", "/api/printer?exclude=temperature,sd", null, onError,
        (data) => {
            onSuccess(data.state.flags.printing);
        });
};

// Commands, changing the printer state
OP.prototype.startPrint = function (onError, onSuccess) {
    var startCmd = {
        "command": "start"
    };

    octoprintRequest(this, "POST", "/api/job", startCmd, onError,
        () => { onSuccess(); }
    );
};

OP.prototype.stopPrint = function (onError, onSuccess) {
    var cancelCmd = {
        "command": "cancel"
    };

    octoprintRequest(this, "POST", "/api/job", cancelCmd, onError,
        () => { onSuccess(); }
    );
};

OP.prototype.pausePrint = function (onError, onSuccess) {
    var pauseCmd = {
        "command": "pause",
        "action": "pause"
    };

    octoprintRequest(this, "POST", "/api/job", pauseCmd, onError,
        () => { onSuccess(); }
    );
};

OP.prototype.resumePrint = function (onError, onSuccess) {
    var pauseCmd = {
        "command": "pause",
        "action": "resume"
    };

    octoprintRequest(this, "POST", "/api/job", pauseCmd, onError,
        () => { onSuccess(); }
    );
};

OP.prototype.autoHome = function (onError, onSuccess) {
    var homeCmd = {
        "command": "home",
        "axes": ["x", "y", "z"]
    };

    octoprintRequest(this, "POST", "/api/printer/printhead", homeCmd, onError,
        () => { onSuccess(); }
    );
};

OP.prototype.disableSteppers = function (onError, onSuccess) {
    var disableStepCmd = {
        "command": "M18"
    };

    octoprintRequest(this, "POST", "/api/printer/command", disableStepCmd, onError,
        () => { onSuccess(); }
    );
};

OP.prototype.hotendsCooldown = function (onError, onSuccess) {
    var hotendCooldownCmd = {
        "command": "target",
        "targets": {
            "tool0": 0,
            "tool1": 0
        }
    };

    octoprintRequest(this, "POST", "/api/printer/tool", hotendCooldownCmd, onError,
        () => { onSuccess(); }
    );
};

OP.prototype.bedCooldown = function (onError, onSuccess) {
    var bedCooldownCmd = {
        "command": "target",
        "target": 0
    };

    octoprintRequest(this, "POST", "/api/printer/bed", bedCooldownCmd, onError,
        () => { onSuccess(); }
    );
};

OP.prototype.cooldown = function (onError, onSuccess) {
    this.hotendsCooldown(onError, () => {
        this.bedCooldown(onError, onSuccess);
    });
};

// EXPORT
module.exports = OP;

// HELPER METHODS
function octoprintRequestSettings(url, key, method, path, data) {
    var fullUrl = url + '/' + path;

    return {
        uri: fullUrl,
        method: method,
        headers: {
            'X-Api-Key': key
        },
        json: data
    };
}