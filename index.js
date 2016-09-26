var config = require('./config');
var irc    = require('irc');

var client = new irc.Client('irc.chat.twitch.tv', config.name.toLowerCase(), {
    userName:   config.name,
    realName:   config.name,
    password:   config.password,
    port:       443,
    secure:     true,
    debug:      false,
    channels:   [config.channel]
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
    console.log('part:', nick);

    if (config.announceUsers && name.toLowerCase() !== config.name.toLowerCase())
        say(name + ' left');
});

client.addListener('message' + config.channel, function(from, message) {
    console.log('message:', from, '=>', message);

    if (message.indexOf('!') === 0) {
        message = message.substr(1).toLowerCase();

        var parts = message.split(' ');

        var command = parts[0];

        if (command in config.commands) {
            var handler = config.commands[command];

            if (typeof handler === 'function') {
                var message = handler(rollDice());
                if (message)
                    say(message);
            }
            else if (typeof handler === 'string')
                say(handler);
        }
    }
});

function rollDice(min, max) {
    min = min || 0;
    max = max || 100;

    return Math.floor(Math.random() * (max - min + 1) + min);
}

function say(message) {
    client.say(config.channel, message);
}
