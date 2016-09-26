// Require dependencies

var config = require('./config');
var irc    = require('irc');

// Check config for required options

if (!config)
    throw new Error('config is required');

if (config && typeof config !== 'object')
    throw new Error('config must be an object');

if (!config.name)
    throw new Error('config.name is required');

if (typeof config.name !== 'string')
    throw new Error('config.name must be a string');

if (!config.password)
    throw new Error('config.password is required');

if (typeof config.password !== 'string')
    throw new Error('config.password must be a string');

if (!config.channel)
    throw new Error('config.channel is required');

if (typeof config.channel !== 'string' || config.channel.charAt(0) !== '#')
    throw new Error('config.channel must be a string starting with \'#\'');

// Check config for optional options

if (config.joinMessage && typeof config.joinMessage !== 'string')
    throw new Error('config.joinMessage must be a string');

if (config.announceUsers && typeof config.announceUsers !== 'boolean')
    throw new Error('config.announceUsers must be a boolean');

if (config.commands && typeof config.commands !== 'object')
    throw new Error('config.commands must be an object');

if (config.debug && typeof config.debug !== 'boolean')
    throw new Error('config.debug must be an boolean');

if (config.server && typeof config.server !== 'string')
    throw new Error('config.server must be an string');

if (config.port && typeof config.port !== 'number')
    throw new Error('config.port must be an number');

if (config.secure && typeof config.secure !== 'boolean')
    throw new Error('config.secure must be an boolean');

// Set defaults for optional config options

config.announceUsers = config.announceUsers || false;
config.joinMessage   = config.joinMessage   || false;
config.commands      = config.commands      || {};
config.debug         = config.debug         || false;
config.server        = config.server        || 'irc.chat.twitch.tv';
config.port          = config.port          || 443;
config.secure        = !config.secure       || true;

// Set up the irc client

var client = new irc.Client(config.server, config.name.toLowerCase(), {
    userName:   config.name,
    realName:   config.name,
    password:   config.password,
    port:       config.port,
    secure:     config.secure,
    channels:   [config.channel],
    debug:      config.debug
});

client.addListener('error', function(message) {
    console.log('error: ', message);
});

client.addListener('registered', function() {
    console.log('registered');

    if (config.joinMessage)
        say(config.joinMessage);
});

client.addListener('join' + config.channel, function(name) {
    console.log('join:', name);

    if (config.announceUsers && name.toLowerCase() !== config.name.toLowerCase())
        say(name + ' joined');
});

client.addListener('part' + config.channel, function(name) {
    console.log('part:', name);

    if (config.announceUsers && name.toLowerCase() !== config.name.toLowerCase())
        say(name + ' left');
});

client.addListener('message' + config.channel, function(from, message) {
    console.log('message:', from, '=>', message);

    if (message.indexOf('!') === 0) {
        message = message.substr(1).toLowerCase();

        var parts = message.split(' ');

        var command = parts[0];
        var args    = parts.slice(1);

        if (command in config.commands) {
            var handler = config.commands[command];

            if (typeof handler === 'function') {
                var message = handler(rollDice(), args);
                if (message)
                    say(message);
            }
            else if (typeof handler === 'string')
                say(handler);
        }
    }
});

// Helper functions

function rollDice(min, max) {
    min = min || 0;
    max = max || 100;

    return Math.floor(Math.random() * (max - min + 1) + min);
}

function say(message) {
    client.say(config.channel, message);
}

// Export stuff

module.exports = {
    client: client,
    say:    say
};
