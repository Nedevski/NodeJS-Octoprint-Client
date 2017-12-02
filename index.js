'use strict'

var request = require('request');

function OP(url, key) {
    this.URL = url;
    this.AUTH_KEY = key;
}

var x = (callback) => {
    callback(true, {
        statusCode: response.statusCode,
        body: body
    });
};

// template functions
function octoprintRequest(OP, method, apiPath, commandBody, callback) {
    console.log("OCTO_ENTERED_octoprintRequest");

    // form request settings
    var requestSettings = octoprintRequestSettings(OP.URL, OP.AUTH_KEY, method, apiPath, commandBody);

    // send the request
    request(requestSettings,
        function (error, response, body) {
            if (!error && response.statusCode >= 200 && response.statusCode < 300) {
                if (body) {
                    var receivedData = JSON.parse(body);

                    console.log("OCTO_RECEIVED => ", receivedData);

                    callback(OP, {
                        success: true,
                        statusCode: response.statusCode,
                        data: receivedData
                    });

                    callback(OP, receivedData);
                }
                else {
                    console.log("OCTO_FAILED_MISSING_RESPONSE => ", receivedData);

                    callback(OP, {
                        success: false,
                        statusCode: response.statusCode,
                        data: body,
                        error: error
                    });
                }
            }
            else if (response.statusCode >= 400 && response.statusCode < 500) {
                console.log(`OCTO_${response.statusCode} => `, error, body);
                var errMsg = '';

                if (response.statusCode == 401) errMsg = "Invalid OctoPrint key";
                else if (response.statusCode == 409) errMsg = "OctoPrint prevented this action, because of a conflict";

                callback(OP, {
                    success: false,
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

                callback(OP, {
                    status: false,
                    statusCode: response.statusCode,
                    data: body,
                    err: error,
                    errMsg: "Couldn't connect to Octoprint instance."
                });
            }
        }
    );
}

function ensurePrinterIsNotPrinting(OP, callback) {
    console.log("OCTO_ENTERED_ensurePrinterIsNotPrinting");

    // Gets current printer state and ensures that the printer is not printing.
    // Used to prevent running commands that would affect the print
    octoprintRequest(OP, "GET", "/api/printer?exclude=temperature,sd", null,
        (OP, res) => {
            if (res.data.state.flags.printing) {
                callback(OP, {
                    success: false,
                    statusCode: res.statusCode,
                    body: res.body,
                    err: res.error,
                    errMsg: "I can't do this while the printer is printing."
                });
            }
            else {
                callback(OP, {
                    success: true,
                    statusCode: res.statusCode,
                    body: res.body,
                });

                callback(OP);
            }
        }
    );
};

// INTENT ACTIONS

OP.prototype.getOctoprintVersion = function (callback) {
    octoprintRequest(OP, "GET", "/api/version", null,
        (OP, data) => { callback(data); }
    );
};

OP.prototype.getCurrentJobState = function (callback) {
    octoprintRequest(OP, "GET", "/api/job", null,
        (OP, data) => {
            (OP, data) => { callback(data); }
        }
    );
};

OP.prototype.getCurrentTemperatures = function (callback) {
    octoprintRequest(OP, "GET", "/api/printer?exclude=sd,state", null,
        (OP, data) => { callback(data); }
    );
};

// Get the print status, will be used to prompt the user for the selected file name
OP.prototype.prepareForStartPrint = function (callback) {
    ensurePrinterIsNotPrinting(OP, (OP) => {
        octoprintRequest(OP, "GET", "/api/job", null, (OP, data) => {
            callback(data);
        });
    });
};

// Checks if the printer is printing, returns true/false
OP.prototype.checkIfPrinterIsPrinting = function (callback) {
    octoprintRequest(OP, "GET", "/api/printer?exclude=temperature,sd", null, (OP, data) => {
        callback(data.state.flags.printing);
    });
};

// INTENT FUNCTIONS START
// Commands, changing the printer state
OP.prototype.startPrint = function (callback) {
    var startCmd = {
        "command": "start"
    };

    octoprintRequest(OP, "POST", "/api/job", startCmd,
        (OP, data) => { callback(data); }
    );
};

OP.prototype.stopPrint = function (callback) {
    var cancelCmd = {
        "command": "cancel"
    };

    octoprintRequest(OP, "POST", "/api/job", cancelCmd,
        (OP, data) => { callback(data); }
    );
};

OP.prototype.pausePrint = function (callback) {
    var pauseCmd = {
        "command": "pause",
        "action": "pause"
    };

    octoprintRequest(OP, "POST", "/api/job", pauseCmd,
        (OP, data) => { callback(data); }
    );
};

OP.prototype.resumePrint = function (callback) {
    var pauseCmd = {
        "command": "pause",
        "action": "resume"
    };

    octoprintRequest(OP, "POST", "/api/job", pauseCmd,
        (OP, data) => { callback(data); }
    );
};

OP.prototype.autoHome = function (callback) {
    var homeCmd = {
        "command": "home",
        "axes": ["x", "y", "z"]
    };

    octoprintRequest(OP, "POST", "/api/printer/printhead", homeCmd,
        (OP, data) => { callback(data); }
    );
};

OP.prototype.disableSteppers = function (callback) {
    var disableStepCmd = {
        "command": "M18"
    };

    octoprintRequest(OP, "POST", "/api/printer/command", disableStepCmd,
        (OP, data) => { callback(data); }
    );
};

OP.prototype.hotendsCooldown = function (callback) {
    var hotendCooldownCmd = {
        "command": "target",
        "targets": {
            "tool0": 0,
            "tool1": 0
        }
    };

    octoprintRequest(OP, "POST", "/api/printer/tool", hotendCooldownCmd,
        (OP, data) => { callback(data); }
    );
};
OP.prototype.bedCooldown = function (callback) {
    var bedCooldownCmd = {
        "command": "target",
        "target": 0
    };

    octoprintRequest(OP, "POST", "/api/printer/bed", bedCooldownCmd,
        (OP, data) => { callback(data); }
    );
};

// REQUEST HELPER METHODS

//function getCurrentJobInfo(OP, callback) {
//    octoprintRequest(OP, "GET", "/api/job", null,
//        (OP, data) => { callback(OP, data); }
//    );
//};

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