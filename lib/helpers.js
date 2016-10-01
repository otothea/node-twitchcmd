var joi       = require('joi');
var constants = require('./constants');

module.exports = {
    validateConfig: validateConfig,
};

function validateConfig(_config) {
    var schema = joi.object().keys({
        name:        joi.string().lowercase().required(),
        password:    joi.string().required(),
        channel:     joi.string().regex(constants.CHANNEL_REGEX).required(),
        commands:    joi.object().required(),
        joinMessage: joi.alternatives().try(joi.string(), joi.boolean()).default(false),
        debug:       joi.boolean().default(false),
        server:      joi.string().default(constants.TWITCH_IRC_SERVER).uri(),
        port:        joi.number().default(constants.TWITCH_IRC_PORT).integer().positive(),
        secure:      joi.boolean().default(true)
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