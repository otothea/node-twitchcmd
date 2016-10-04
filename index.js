// Require dependencies

var irc       = require('irc');
var helpers   = require('./lib/helpers');
var constants = require('./lib/constants');

// Set up app

var initialized  = false;
var exited       = false;
var config       = null;
var client       = null;
var users        = {};
var messageCount = 0;

module.exports = {
    init: init,
    exit: exit
};

return;

// Exports

function init(_config) {
    if (initialized)
        return;

    // Validate the config
    config = helpers.validateConfig(_config);

    // Create a user for the bot
    users[config.name] = helpers.createUser(true);

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

function exit() {
    if (exited)
        return;

    log('Exiting...', true);

    // Leave the channel
    if (client)
        client.part(config.channel);

    exited = true;
}

// Event Handlers

function onError(message) {
    error(message, true);
}

function onRegistered() {
    log('Initialized...', true);

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
    users[name] = users[name] || helpers.createUser();
}

function onPart(name) {
    log('part: ' + name);

    // If we have exited, disconnect
    if (name === config.name && exited) {
        say(config.partMessage);
        client.disconnect();
    }

    // Remove user from index
    users[name] = undefined;
}

function onMotd(motd) {
    log('MOTD:\n' + motd);
}

function onNotice(name, to, text, message) {
    log('notice: ' + name + ' ' + to + ' ' + text + ' ' + message);
}

function onMessage(from, message) {
    log('message: ' + from + ' => ' + message);

    // Increment message count
    messageCount++;

    // Ignore if spam
    if (isSpam(from, message))
        return;

    // Check for command prefix
    if (message.indexOf(config.commandPrefix) === 0)
        onCommand(from, message);
}

function onCommand(from, message) {
    // Strip the command prefix from the message
    message = message.substr(config.commandPrefix.length).toLowerCase();

    // Split up the message into command and arguments array
    var parts   = message.split(' ');
    var command = parts[0];
    var args    = parts.slice(1);

    // If it's a valid command
    if (config.commands[command]) {
        var handler = config.commands[command];
        var mod     = users[from] && users[from].mod;

        // If it's a function, run it
        if (typeof handler === 'function') {
            // Call the handler and convert to promise
            var response = handler(args, mod);
            response = Promise.resolve(response);
            response.then(say);
        }
        // If it's a string, just say it
        else if (typeof handler === 'string')
            say(handler);
    }
    // Available commands
    else if (command === 'cmd') {
        var commands = Object.keys(config.commands);

        // If commands exist
        if (commands.length)
            say('Available Commands: ' + config.commandPrefix + commands.join(', ' + config.commandPrefix));
    }
}

function onRaw(message) {
    // Ignore commands that we already get in other ways
    if (!constants.IGNORE_COMMANDS[message.command])
        log(message);

    // If MODE command, trigger mode event
    if (message.command === 'MODE')
        onMode(message.args[0], message.nick, message.args[1], message.args[2]);
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
        else if (mode === constants.MODES.SUB_MOD && users[argument]) {
            users[argument].mod = false;
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

function isSpam(from, message) {
    if (!config.filterSpam)
        return false;

    if (users[from] && users[from].mod)
        return false;

    var uppercaseCount = message.replace(/[^A-Z]/g, "").length;
    if (uppercaseCount >= 10 && uppercaseCount >= message.length / 2) {
        timeoutUser(from, 'stop using capital letters');
        return true;
    }

    return false;
}

function twitchCommand(command, message) {
    if (typeof command === 'string')
        client.send('PRIVMSG', config.channel, '/' + command + ' ' + (message || ''));
}

function timeoutUser(name, reason) {
    name   = name   || '';
    reason = reason || '';

    users[name] = users[name] || helpers.createUser();
    users[name].offenses++;

    var offenses = users[name].offenses;

    if (offenses > config.maxOffenses)
        banUser(name);
    else {
        var seconds = offenses === 1 ? 10 : 60;
        twitchCommand('timeout', name + ' ' + seconds + ' ' + reason + ' - warning ' + offenses + ' of ' + config.maxOffenses);
    }
}

function banUser(name) {
    twitchCommand('ban', name + ' too many chat offenses');
}

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
