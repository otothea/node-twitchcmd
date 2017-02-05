var joi       = require('joi');
var constants = require('./constants');

module.exports = {
  validateConfig: validateConfig,
  createUser:     createUser,
  createTimeout:  createTimeout,
};

/**
 * Validate the init config object
 *
 * @param config {object} - config to init the bot
 *
 * @returns {object} - validated config
 */
function validateConfig(config) {
  var twitch = joi.object({
    server:      joi.string().trim().uri().default(constants.TWITCH_IRC_SERVER),
    port:        joi.number().integer().positive().default(constants.TWITCH_IRC_PORT),
    secure:      joi.boolean().default(true),
    name:        joi.string().trim().required().lowercase(),
    password:    joi.string().trim().required(),
    channel:     joi.string().trim().required().regex(constants.CHANNEL_REGEX),
    filterSpam:  joi.boolean().default(false),
    maxOffenses: joi.number().integer().positive().default(constants.MAX_OFFENSES),
  });

  var discord = joi.object({
    token:    joi.alternatives().try(joi.string().trim(), joi.boolean()).default(false),
    channels: joi.array().items(joi.string().trim()).default([]),
  });

  var command = joi.object({
    mod:     joi.boolean().default(false),
    handler: joi.alternatives().try(joi.func().maxArity(1), joi.string()).required(),
  });

  var timer = joi.object({
    seconds: joi.number().integer().positive().default(60 * 5),
    handler: joi.alternatives().try(joi.func().arity(0), joi.string()).required(),
  });

  var schema = joi.object({
    twitch:        twitch.required(),
    discord:       discord.default({}),
    joinMessage:   joi.alternatives().try(joi.string().trim(), joi.boolean()).default(false),
    partMessage:   joi.alternatives().try(joi.string().trim(), joi.boolean()).default(false),
    commandPrefix: joi.string().trim().default(constants.COMMAND_PREFIX),
    commands:      joi.object().pattern(/\w/, command),
    timers:        joi.array().items(timer).default([]),
    autoExit:      joi.boolean().default(true),
    debug:         joi.boolean().default(false),
    log:           joi.alternatives().try(joi.string().trim(), joi.boolean()).default('chat_logs'),
  });

  var validation = schema.validate(config);

  if (validation.error) {
    var error = 'Your twitchcmd configuration is invalid.\n' +
        'Please consult the README.md for more information.\n' +
        validation.error.message;

    throw new Error(error);
  }

  return validation.value;
}

/**
 * Create a new user
 *
 * @param [mod] {boolean} - whether or not the user should be a mod (default: false)
 *
 * @returns {object} - new user
 */
function createUser(mod) {
  return {
    mod:      mod || false,
    offenses: 0,
  };
}

/**
 * Create a new timeout
 *
 * @param timer    {object}   - timer to use for the timeout
 * @param i        {number}   - index of the timer object
 * @param callback {function} - function to call when the timeout triggers
 */
function createTimeout(timer, i, callback) {
  return setTimeout(function() {
    callback(timer, i);
  }, timer.seconds * 1000);
}
