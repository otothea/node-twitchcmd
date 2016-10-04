[![npm](https://img.shields.io/npm/v/twitchcmd.svg?style=flat)](https://www.npmjs.com/package/twitchcmd)
[![MIT License](https://img.shields.io/github/license/otothea/node-twitchcmd.svg)](https://github.com/otothea/node-twitchcmd/blob/master/LICENSE)
[![Dependency Status](https://david-dm.org/otothea/node-twitchcmd.svg)](https://david-dm.org/otothea/node-twitchcmd)

# Twitch Command

Twitch Command is a simple [node-irc](https://github.com/martynsmith/node-irc) client. The purpose of this app is to allow users to easily create custom commands for their Twitch channel.

**IMPORTANT:** Don't forget to set your bot as a moderator in your channel

### Prerequisites

- npm
- [Create a twitch account for your bot](https://twitch.tv/signup)

### Install

```
$ npm install --save twitchcmd
```

**NOTE:** npm may throw up an error saying `fatal error: 'unicode/ucsdet.h' file not found` but it is a non-issue for this app

### Usage

```
var twitchcmd = require('twitchcmd');
 
var config = {
    name: 'MuhBot',
    password: 'oauth:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    channel: '#muhname',
    joinMessage: 'Hello world!',
    partMessage: 'Goodbye world!',
    commands: {
        test: 'It works!'
    },
    timers: [{
        seconds: 300,
        handler: 'Still here!'
    }]
}
 
twitchcmd.init(config);
 
process.on('SIGINT', () => {
    twitchcmd.exit();
});
```

##### Config options

- **name** {string} [required] - Your Twitch bot username
- **password** {string} [required] - Your Twitch bot *oauth* password (**NOT** the Twitch password, [get your *oauth* password here](https://twitchapps.com/tmi/))
- **channel** {string} [required] - Your Twitch channel name (must include the `#`)
- **commandPrefix** {string} - The character commands start with (default: `!`)
- **commands** {object} - See [Command Map](#command-map)
- **timers** {object[]} - See [Timers](#timers)
- **joinMessage** {string} - The message your bot posts to chat when it joins the channel (default: no message)
- **partMessage** {string} - The message your bot posts to chat when it leaves the channel (default: no message)
- **filterSpam** {boolean} - Set to `true` to enable spam filters (default: `false`) See [Spam Filters](#spam-filters)
- **maxOffenses** {number} - Number of offenses before user is banned (default `3`) See [Spam Filters](#spam-filters)
- **debug** {boolean} - Set to `true` to turn on debug logging (default: `false`)

### Command Map

Map commands to your bot using the `commands` option in your `config`. Commands can map to a `string`, or a `function` that either returns a `string` or returns a `Promise` that resolves a `string`. If you do not want your bot to respond, don't return anything.

##### String example

This command map will respond to the command `!test` with `It works!`:

```
commands: {
    test: 'It works!'
}
```

###### Twitch chat

```
@MuhName: !test all the things
@MuhBot: It works!
```

##### Function example

If mapped to a function, the text you return or resolve will be sent to the Twitch chat. If you return or resolve anything other than a `string`, your bot will do nothing.

###### Arguments

- **args** {string[]} - Array of arguments from the chat command
- **mod** {boolean} - Whether or not the sender is a moderator

This command map will respond to the command `!giphy` with an image that matches the input args using [request](https://github.com/request/request):

```
commands: {
    giphy: function(args, mod) {
        if (!mod) return; // restrict this command to moderators only
 
        var opts = {
            json: true,
            qs: {
                q:       args.join(' '),
                api_key: 'dc6zaTOxFJmzC'
            }
        };
 
        return new Promise(function(resolve, reject) {
            request.get('http://api.giphy.com/v1/gifs/search', opts, function(err, res) {
                if (err)
                    return reject(err);

                resolve(res.body.data[0].images.original.url);
            });
        }).catch(console.error);
    }
}
```

###### Twitch chat

```
@MuhName: !giphy funky chicken
@MuhBot: http://media4.giphy.com/media/3oGRFBMkvqEzGKtwcw/giphy.gif
```

##### Available commands

Every bot supports the `!cmd` command which lists all of the available commands

```
@MuhName: !cmd
@MuhBot: Available Commands: !test, !giphy
```

### Timers

Create messages that run on intervals using the `timers` option in your `config`.

##### Timer object

- **seconds** {number} - Number of seconds between each tick
- **handler** {string | function&lt;string | Promise&lt;string&gt;&gt;} - Handler for the timer

##### Example

```
timers: [{
    seconds: 300,
    handler: 'Still here!'
}]
```

### Spam Filters

- Excessive capital letters - triggered when 10 or more capital letters make up a majority of the message

If a user triggers a spam filter, they will be timed out for 10 seconds for the first offense and 60 seconds for each offense after. If a user hits the `maxOffense` limit, they will be banned from the channel.

**NOTE:** Moderators can unban users from the channel by typing `/unban <username>` in the twitch chat

More filters to come, suggestions welcome
