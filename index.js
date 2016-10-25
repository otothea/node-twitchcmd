// Require dependencies

var fs        = require('fs');
var path      = require('path');
var irc       = require('irc');
var request   = require('request');
var moment    = require('moment');
var mkdirp    = require('mkdirp');
var Discord   = require('discord.io');
var helpers   = require('./lib/helpers');
var constants = require('./lib/constants');

// Set up app

var initialized     = false; // {boolean}        - whether or not the app has been initialized
var exited          = false; // {boolean}        - whether or not the app has been exited
var config          = null;  // {object}         - configuration object for the app
var ircClient       = null;  // {irc.Client}     - the irc client
var discordClient   = null;  // {Discord.Client} - the discord client
var users           = {};    // {object}         - users in the channel, indexed by nickname
var lastCommandUse  = {};    // {object}         - unix timestamp of the last command usage
var streamInterval  = null;  // {interval}       - interval for stream checking
var streamLive      = true;  // {boolean}        - whether or not the channel stream is live on Twitch
var streamOfflineAt = null;  // {number}         - timestamp of when the stream went offline
var timeouts        = [];    // {timeout[]}      - array of timeout pointers for clearing timeouts
var discordReady    = false; // {boolean}        - whether or not discord is ready

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
    ircClient = new irc.Client(config.server, config.name, {
        userName: config.name,
        realName: config.name,
        password: config.password,
        port:     config.port,
        secure:   config.secure,
    });

    // Add listeners
    ircClient.addListener('error',                    onError);
    ircClient.addListener('registered',               onRegistered);
    ircClient.addListener('join' + config.channel,    onJoin);
    ircClient.addListener('part' + config.channel,    onPart);
    ircClient.addListener('motd',                     onMotd);
    ircClient.addListener('notice',                   onNotice);
    ircClient.addListener('message' + config.channel, onMessage);
    ircClient.addListener('raw',                      onRaw);

    // If there is a discord token
    if (config.discordToken) {
        // Init the discord client
        discordClient = new Discord.Client({
            token:   config.discordToken,
            autorun: true,
        });

        // Add listeners
        discordClient.on('ready', onDiscordReady);
    }

    // If we are logging, create the directory if not exists
    if (config.log && typeof config.log === 'string')
        mkdirp.sync(config.log);

    // Init stream checker
    if (config.autoExit || config.discordToken)
        streamInterval = setInterval(onCheckStream, 60 * 1000)

    initialized = true;
}

/**
 * Exit the twitch bot
 */
function exit() {
    if (!initialized || exited)
        return;

    log('Exiting...', true);

    // Leave the twitch channel
    if (ircClient)
        ircClient.part(config.channel);

    // Leave discord
    if (discordClient)
        discordClient.disconnect();

    // Clear the stream check interval
    if (streamInterval)
        clearInterval(streamInterval);

    // Clear all the timeouts
    timeouts.forEach(function(t) {
        clearTimeout(t);
    });

    exited = true;
}

/**
 * Event handlers
 */

function onError(message) {
    error(message, true);
}

function onDiscordReady() {
    discordReady = true;
}

function onRegistered() {
    log('Initialized...', true);

    // Send the Capabilities command
    // https://help.twitch.tv/customer/portal/articles/1302780-twitch-irc
    ircClient.send('CAP', 'REQ', constants.TWTTCH_MEMBERSHIP);

    // Join the channel
    ircClient.join(config.channel);
}

function onJoin(name) {
    log('join: ' + name);

    // Say the join message
    if (name === config.name) {
        say(config.joinMessage);

        // Init the timers
        config.timers.forEach(function(timer, i) {
            timeouts[i] = helpers.createTimeout(timer, i, onTimer);
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

        ircClient.disconnect();
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

    // Log the message
    logChat(from, message);

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
    var now  = moment().unix();
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
    else if (command === 'ping')
        say('pong');

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

function onTimer(timer, i) {
    // If function, run it
    if (typeof timer.handler === 'function') {
        // Call the handler and convert to promise
        var response = timer.handler();
        response = Promise.resolve(response);
        response.then(function(message) {
            say(message);

            // Start a new timeout
            timeouts[i] = helpers.createTimeout(timer, i, onTimer);
        });

        return;
    }
    // If string, just say it
    else if (typeof timer.handler === 'string')
        say(timer.handler);

    timeouts[i] = helpers.createTimeout(timer, i, onTimer);
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
        var data = (res || {}).body || {};

        if (data.stream) {
            log('stream: live');

            // If the stream was offline before
            if (streamLive === false)
                onDiscordAnnounce(data.stream);

            streamLive = true;
        }
        else if (data.stream === null) {
            log('stream: offline');

            var now = moment().unix();
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

function onDiscordAnnounce(stream) {
    if (!discordReady)
        return;

    // Create the message
    var message = stream.channel.display_name + ' is streaming ' +
        stream.game + ' - ' + stream.channel.status + ' @ ' +
        stream.channel.url;

    // Send an announcement to all the discord channels
    config.discordChannels.forEach(function(id) {
        sendDiscordMessage(id, message);
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

    // Skip if this is a mod
    if (users[from] && users[from].mod)
        return false;

    // Check for capital letter spam
    var uppercaseCount = message.replace(/[^A-Z]/g, '').length;
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
    if (!ircClient || typeof command !== 'string')
        return;

    ircClient.send('PRIVMSG', config.channel, '/' + command + ' ' + (args || ''));
}

/**
 * Timeout a user in chat
 *
 * @param name    {string}      - nickname of the user to timeout
 * @param seconds {number|null} - number of seconds to timeout
 * @param reason  {string}      - the reason for the timeout
 */
function timeoutUser(name, seconds, reason) {
    name   = name   || '';
    reason = reason || '';

    // Create a user if it doesn't exist
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
    if (!ircClient || typeof message !== 'string')
        return;

    ircClient.say(config.channel, message);
}

/**
 * Send a message to Discord channel
 *
 * @param id      {string} - id of the channel to send message
 * @param message {string} - message to send to channel
 */
function sendDiscordMessage(id, message) {
    if (!discordClient || typeof id !== 'string' || typeof message !== 'string')
        return;

    discordClient.sendMessage({
        to:      id,
        message: message
    });
}

/**
 * Log message to chat logs
 *
 * @param from    {string} - name of person sending the message
 * @param message {string} - the message sent
 */
function logChat(from, message) {
    if (typeof config.log !== 'string' || !from || typeof message !== 'string')
        return;

    // Get the current moment
    var now  = moment();

    // Create the file name
    var file = path.join(config.log, now.format('YYYY-MM-DD') + '-' + 'chat.log');

    // Create the text to log based on moment and chat info
    var text = '[' + now.format('YYYY-MM-DD hh:mm A') + '] ' + from + ': ' + message + '\n';

    // Append the text to the log file
    fs.appendFile(file, text, function(err) {
        if (err)
            error(err);
    });
}

/**
 * Log a message
 *
 * @param message {string}  - message to log
 * @param [force] {boolean} - set to `true` to force log even if not debug
 */
function log(message, force) {
    if (config.debug || force)
        console.log(message);
}

/**
 * Log an error
 *
 * @param message {string}  - message to log
 * @param [force] {boolean} - set to `true` to force log even if not debug
 */
function error(message, force) {
    if (config.debug || force)
        console.log('Error:', message);
}
