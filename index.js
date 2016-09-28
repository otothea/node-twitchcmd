// Require dependencies

var joi   = require('joi');
var chalk = require('chalk');
var irc   = require('irc');

// Set up app

var initialized = false;
var config      = null;
var client      = null;

module.exports = {
    init: init
};

function init(_config) {
    if (initialized)
        return;

    config = validateConfig(_config);

    client = new irc.Client(config.server, config.name.toLowerCase(), {
        userName: config.name,
        realName: config.name,
        password: config.password,
        port:     config.port,
        secure:   config.secure,
        channels: [config.channel]
    });

    client.addListener('error',                    onError);
    client.addListener('registered',               onRegistered);
    client.addListener('join' + config.channel,    onJoin);
    client.addListener('part' + config.channel,    onPart);
    client.addListener('message' + config.channel, onMessage);

    initialized = true;
}

// Event Handlers

function onError(message) {
    error(message);
}

function onRegistered() {
    log('Bot is running...', true);

    if (config.joinMessage)
        say(config.joinMessage);
}

function onJoin(name) {
    log('join: ' + name);

    announce(name, 'joined');
}

function onPart(name) {
    log('part: ' + name);

    announce(name, 'left');
}

function onMessage(from, message) {
    log('message: ' + from + ' => ' + message);

    if (message.indexOf('!') !== 0)
        return;

    message = message.substr(1).toLowerCase();

    var parts = message.split(' ');

    var command = parts[0];
    var args    = parts.slice(1);

    if (command in config.commands) {
        var handler = config.commands[command];

        if (typeof handler === 'function') {
            var response = Promise.resolve(handler(args));
            response.then(function(response) {
                if (typeof response === 'string')
                    say(response);
            });
        }
        else if (typeof handler === 'string')
            say(handler);
    }
    else if (command === 'cmd') {
        var commands = Object.keys(config.commands);

        if (commands.length)
            say('Available Commands: !' + Object.keys(config.commands).join(', !'));
        else
            say('No commands available');
    }
}

// Helper functions

function validateConfig(_config) {
    var schema = joi.object().keys({
        name:          joi.string().required(),
        password:      joi.string().required(),
        channel:       joi.string().regex(/^#/).required(),
        commands:      joi.object().required(),
        joinMessage:   joi.alternatives().try(joi.string(), joi.boolean()).default(false),
        announceUsers: joi.boolean().default(false),
        debug:         joi.boolean().default(false),
        server:        joi.string().default('irc.chat.twitch.tv').uri(),
        port:          joi.number().default(443).integer().positive(),
        secure:        joi.boolean().default(true)
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

function announce(name, action) {
    if (config.announceUsers && name.toLowerCase() !== config.name.toLowerCase())
        say(name + ' ' + action);
}

function say(message) {
    client.say(config.channel, message);
}

function log(message, force) {
    if (config.debug || force)
        console.log(message);
}

function error(message) {
    if (config.debug || force)
        console.error(chalk.red(message));
}
