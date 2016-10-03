var joi       = require('joi');
var constants = require('./constants');

module.exports = {
    validateConfig: validateConfig,
    createUser:     createUser,
    createTimeout:  createTimeout,
};

function validateConfig(_config) {
    var timer = joi.object().keys({
        seconds: joi.number().integer().positive().default(60 * 5),
        handler: joi.alternatives().try(joi.func().arity(0), joi.string()).required()
    });

    var schema = joi.object().keys({
        debug:       joi.boolean().default(false),
        server:      joi.string().uri().default(constants.TWITCH_IRC_SERVER),
        port:        joi.number().integer().positive().default(constants.TWITCH_IRC_PORT),
        secure:      joi.boolean().default(true),
        name:        joi.string().required().lowercase(),
        password:    joi.string().required(),
        channel:     joi.string().required().regex(constants.CHANNEL_REGEX),
        joinMessage: joi.alternatives().try(joi.string(), joi.boolean()).default(false),
        partMessage: joi.alternatives().try(joi.string(), joi.boolean()).default(false),
        commands:    joi.object().default({}),
        timers:      joi.array().items(timer).default([]),
    });

    var validation = joi.validate(_config, schema);

    if (validation.error) {
        var error = 'Your twitchcmd configuration is invalid.\n' +
            'Please consult the README.md for more information.\n' +
            validation.error.message;

        throw new Error(error);
    }

    return validation.value;
}

function createUser() {
    return { mod: false };
}

function createTimeout(timer, callback) {
    setTimeout(function() {
        callback(timer);
    }, timer.seconds * 1000);
}
