// Require dependencies

var irc       = require('irc');
var helpers   = require('./lib/helpers');
var constants = require('./lib/constants');

// Set up app

var initialized = false; // Boolean
var config      = null;  // Object
var client      = null;  // irc.Client

var users = {}; // index users in channel

module.exports = {
    init: init
};

function init(_config) {
    if (initialized)
        return;

    config = helpers.validateConfig(_config);

    // Init the client
    client = new irc.Client(config.server, config.name, {
        userName: config.name,
        realName: config.name,
        password: config.password,
        port:     config.port,
        secure:   config.secure,
    });

    // Add listeners
    client.addListener('error',                    onError);
    client.addListener('registered',               onRegistered);
    client.addListener('join' + config.channel,    onJoin);
    client.addListener('part' + config.channel,    onPart);
    client.addListener('motd',                     onMotd);
    client.addListener('notice',                   onNotice);
    client.addListener('message' + config.channel, onMessage);
    client.addListener('raw',                      onRaw);

    // Init the timers
    config.timers.forEach(function(timer) {
        helpers.createTimeout(timer, onTimer);
    });

    initialized = true;
}

// Event Handlers

function onError(message) {
    error(message, true);
}

function onRegistered() {
    log('Running...', true);

    // Send the Capabilities command
    // https://help.twitch.tv/customer/portal/articles/1302780-twitch-irc
    client.send('CAP', 'REQ', constants.TWTTCH_MEMBERSHIP);

    // Join the channel
    client.join(config.channel);
}

function onJoin(name) {
    log('join: ' + name);

    // Say the join message
    if (name === config.name)
        say(config.joinMessage);

    // Index user with defaults
    users[name] = helpers.createUser();
}

function onPart(name) {
    log('part: ' + name);

    // Remove user from index
    users[name] = undefined;
}

function onMotd(motd) {
    log('MOTD: ' + motd);
}

function onNotice(name, to, text, message) {
    log('notice: ' + name + ' ' + to + ' ' + text + ' ' + message);
}

function onRaw(message) {
    if (!(message.command in constants.IGNORE_COMMANDS))
        log(message);

    // If MODE command, trigger mode event
    if (message.command === 'MODE')
        onMode(message.args[0], message.nick, message.args[1], message.args[2]);
}

function onMessage(from, message) {
    log('message: ' + from + ' => ' + message);

    // Check if command syntax (starts with '!')
    if (message.indexOf('!') !== 0)
        return;

    // Strip the '!' from the message
    message = message.substr(1).toLowerCase();

    // Split up the message into command and arguments array
    var parts   = message.split(' ');
    var command = parts[0];
    var args    = parts.slice(1);

    // If it's a valid command
    if (command in config.commands) {
        var handler  = config.commands[command];
        var mod      = users[from] && users[from].mod;

        // If function, run it
        if (typeof handler === 'function') {
            // Call the handler and convert to promise
            var response = handler(args, mod);
            response = Promise.resolve(response);
            response.then(say);
        }
        // If string, just say it
        else if (typeof handler === 'string')
            say(handler);
    }
    // Available commands
    else if (command === 'cmd') {
        var commands = Object.keys(config.commands);

        if (commands.length)
            say('Available Commands: !' + commands.join(', !'));
    }
}

function onMode(channel, by, mode, argument, message) {
    log('mode: ' + channel + ' ' + by + ' ' + mode + ' ' + argument + ' ' + message);

    // If it's for this channel and sent from Twitch
    if (channel === config.channel && by === constants.TWITCH_NAME) {
        // Add mod
        if (mode === constants.MODES.ADD_MOD) {
            users[argument] = users[argument] || helpers.createUser();
            users[argument].mod = true;
        }
        // Subtract mod
        else if (mode === constants.MODES.SUB_MOD) {
            users[argument] = users[argument] || helpers.createUser();
        }
    }
}

function onTimer(timer) {
    // If function, run it
    if (typeof timer.handler === 'function') {
        // Call the handler and convert to promise
        var response = timer.handler();
        response = Promise.resolve(response);
        response.then(function(message) {
            say(message);

            helpers.createTimeout(timer, onTimer);
        });

        return;
    }
    // If string, just say it
    else if (typeof timer.handler === 'string')
        say(timer.handler);

    helpers.createTimeout(timer, onTimer);
}

// Helper functions

function say(message) {
    if (typeof message === 'string')
        client.say(config.channel, message);
}

function log(message, force) {
    if (config.debug || force)
        console.log(message);
}

function error(message, force) {
    if (config.debug || force)
        console.log('Error:', message);
}
