// Require dependencies

var joi   = require('joi');
var chalk = require('chalk');
var irc   = require('irc');

// Set up app

var initialized = false;
var config      = null;
var client      = null;

if (!module.parent) {
    init();
}
else {
    module.exports = {
        init: init
    };
}

function init(_config) {
    if (initialized)
        return;

    config = _config || require('./config');

    validateConfig();

    client = new irc.Client(config.server, config.name.toLowerCase(), {
        userName:   config.name,
        realName:   config.name,
        password:   config.password,
        port:       config.port,
        secure:     config.secure,
        channels:   [config.channel],
        debug:      config.debug
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
    console.error(chalk.red(message));
}

function onRegistered() {
    console.log('registered');

    if (config.joinMessage)
        say(config.joinMessage);
}

function onJoin(name) {
    console.log('join:', name);

    announce(name, 'joined');
}

function onPart(name) {
    console.log('part:', name);

    announce(name, 'left');
}

function onMessage(from, message) {
    console.log('message:', from, '=>', message);

    if (message.indexOf('!') !== 0)
        return;

    message = message.substr(1).toLowerCase();

    var parts = message.split(' ');

    var command = parts[0];
    var args    = parts.slice(1);

    if (command in config.commands) {
        var handler = config.commands[command];

        if (typeof handler === 'function') {
            var response = handler(rollDice(), args);
            if (response)
                say(response);
        }
        else if (typeof handler === 'string')
            say(handler);
    }
}

// Helper functions

function validateConfig() {
    var schema = joi.object().keys({
        name:          joi.string().required(),
        password:      joi.string().required(),
        channel:       joi.string().regex(/^#/).required(),
        commands:      joi.object().required(),
        joinMessage:   joi.string().default(false),
        announceUsers: joi.boolean().default(false),
        debug:         joi.boolean().default(false),
        server:        joi.string().default('irc.chat.twitch.tv').uri(),
        port:          joi.number().default(443).integer().positive(),
        secure:        joi.boolean().default(true)
    });

    var validation = joi.validate(config, schema);

    if (validation.error) {

        var error = chalk.red('Your Twitch Command configuration is invalid.\n') +
            'Please consult the README.md for more information.\n' +
            validation.error.message;

        if (!module.parent) {
            console.error('Error:', error);
            process.exit(1);
        }
        else {
            throw new Error(error);
        }
    }

    config = validation.value;
}

function rollDice(min, max) {
    min = min || 0;
    max = max || 100;

    return Math.floor(Math.random() * (max - min + 1) + min);
}

function announce(name, action) {
    if (config.announceUsers && name.toLowerCase() !== config.name.toLowerCase())
        say(name + ' ' + action);
}

function say(message) {
    client.say(config.channel, message);
}
