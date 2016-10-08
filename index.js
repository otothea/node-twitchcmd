// Require dependencies

var irc       = require('irc');
var request   = require('request');
var helpers   = require('./lib/helpers');
var constants = require('./lib/constants');

// Set up app

var initialized     = false; // {boolean}    - whether or not the app has been initialized
var exited          = false; // {boolean}    - whether or not the app has been exited
var config          = null;  // {object}     - configuration object for the app
var client          = null;  // {irc.Client} - the irc client
var users           = {};    // {object}     - users in the channel, indexed by nickname
var lastCommandUse  = {};    // {object}     - unix timestamp of the last command usage
var streamInterval  = null;  // {interval}   - interval for stream checking
var streamLive      = true;  // {boolean}    - whether or not the channel stream is live on Twitch
var streamOfflineAt = null;  // {number}     - timestamp of when the stream went offline

module.exports = {
    init:    init,
    exit:    exit,
    timeout: timeoutUser,
    ban:     banUser,
    say:     say,
};

return;

/**
 * Init the twitch bot
 *
 * @param _config {object} - config to init the bot with
 */
function init(_config) {
    if (initialized)
        return;

    // Validate the config
    config = helpers.validateConfig(_config);

    // Create a user for the bot
    users[config.name] = helpers.createUser(true);

    // Create a user for the channel owner
    users[config.channel.replace('#', '')] = helpers.createUser(true);

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

    initialized = true;
}

/**
 * Exit the twitch bot
 */
function exit() {
    if (!initialized || exited)
        return;

    log('Exiting...', true);

    // Leave the channel
    if (client)
        client.part(config.channel);

    clearInterval(streamInterval);

    exited = true;
}

/**
 * Event handlers
 */

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
    if (name === config.name) {
        say(config.joinMessage);

        // Init stream checker
        if (config.autoExit) {
            streamInterval = setInterval(onCheckStream, 60 * 1000)
        }

        // Init the timers
        config.timers.forEach(function(timer) {
            helpers.createTimeout(timer, onTimer);
        });
    }

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
    log('\nMOTD:\n' + motd);
}

function onNotice(name, to, text, message) {
    log('notice: ' + name + ' ' + to + ' ' + text + ' ' + message);
}

function onMessage(from, message) {
    log('message: ' + from + ' => ' + message);

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

    // Get mod status
    var mod = users[from] && users[from].mod;

    // Split up the message into command and arguments array
    var parts   = message.split(' ');
    var command = parts[0];
    var args    = parts.slice(1);

    // Check last command usage time
    var then = lastCommandUse[message]
    var now  = Math.round(Date.now() / 1000);
    var diff = now - then;
    if (!mod && !isNaN(diff) && diff <= 10)
        return;

    // If it's a valid command
    if (config.commands[command]) {
        var handler = config.commands[command];

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

    // Update last command usage time
    lastCommandUse[message] = now;
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
        else if (mode === constants.MODES.SUB_MOD && users[argument])
            users[argument].mod = false;
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

function onCheckStream() {
    // See if stream is live
    // https://dev.twitch.tv/docs/api/v3/streams#get-streamschannel
    var url  = constants.TWITCH_API_URI + 'streams/' + config.channel.replace('#', '');
    var opts = {
        json: true,
        headers: {
            'Client-ID': constants.TWITCH_CLIENT_ID
        }
    };

    request.get(url, opts, function(err, res) {
        var data = res.body || {};

        if (data.stream) {
            log('stream: live');

            streamLive = true;
        }
        else {
            log('stream: offline');

            var now = Math.round(Date.now() / 1000);
            if (streamLive)
                streamOfflineAt = now
            else {
                var timeLimit = now - (60 * 30); // 30 minutes ago
                if (streamOfflineAt <= timeLimit && config.autoExit)
                    exit();
            }
            streamLive = false;
        }
    });
}

// Helper functions

/**
 * Check if message is spam
 *
 * @param from    {string} - nickname of user who sent the message
 * @param message {string} - message being sent
 *
 * @returns {boolean} - true if spam, false if not
 */
function isSpam(from, message) {
    if (!config.filterSpam)
        return false;

    if (users[from] && users[from].mod)
        return false;

    var uppercaseCount = message.replace(/[^A-Z]/g, "").length;
    if (uppercaseCount >= 10 && uppercaseCount >= message.length / 2) {
        timeoutUser(from, null, 'stop using capital letters');
        return true;
    }

    return false;
}

/**
 * Send a command to twitch
 * https://help.twitch.tv/customer/portal/articles/659095-chat-moderation-commands
 *
 * @param command {string} - command to send
 * @param args    {string} - arguments for the command
 */
function twitchCommand(command, args) {
    if (!client || typeof command !== 'string')
        return;

    client.send('PRIVMSG', config.channel, '/' + command + ' ' + (args || ''));
}

/**
 * Timeout a user in chat
 *
 * @param name   {string} - nickname of the user to timeout
 * @param reason {string} - the reason for the timeout
 */
function timeoutUser(name, seconds, reason) {
    name   = name   || '';
    reason = reason || '';

    users[name] = users[name] || helpers.createUser();
    users[name].offenses++;

    var offenses = users[name].offenses;

    if (offenses > config.maxOffenses)
        banUser(name);
    else {
        seconds = seconds || offenses === 1 ? 10 : 60;
        twitchCommand('timeout', name + ' ' + seconds + ' ' + reason + ' - warning ' + offenses + ' of ' + config.maxOffenses);
    }
}

/**
 * Ban a user in chat
 *
 * @param name {string} - nickname of the user to ban
 */
function banUser(name) {
    twitchCommand('ban', name + ' too many chat offenses');
}

/**
 * Say a message to chat
 *
 * @param message {string} - send a message to chat
 */
function say(message) {
    if (!client || typeof message !== 'string')
        return;

    client.say(config.channel, message);
}

/**
 * Log a message
 *
 * @param message {string}  - message to log
 * @param force   {boolean} - set to `true` to force log even if not debug
 */
function log(message, force) {
    if (config.debug || force)
        console.log(message);
}

/**
 * Log an error
 *
 * @param message {string}  - message to log
 * @param force   {boolean} - set to `true` to force log even if not debug
 */
function error(message, force) {
    if (config.debug || force)
        console.log('Error:', message);
}
