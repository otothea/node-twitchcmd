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
    announdUsers: true,
    debug: false,
    commands: {
        test: 'It works!'
    }
}
 
twitchcmd.init(config);
```

##### Available config options

- **name** {string} [required] - Your Twitch bot username
- **password** {string} [required] - Your Twitch bot *oauth* password (**NOT** the Twitch password, [get your *oauth* password here](https://twitchapps.com/tmi/))
- **channel** {string} [required] - Your Twitch channel name (must include the `#`)
- **commands** {object} [required] - [Command Map](#command-map)
- **joinMessage** {string} - The message your bot posts to chat when it joins the channel (default: no message)
- **announceUsers** {boolean} - Set to `true` to announce when users join and leave the chat (default: `false`)
- **debug** {boolean} - Set to `true` to turn on debug logging (default: `false`)

### Command Map

Map commands to your bot using the `commands` option in your `config`. Commands can map to a `string` or a `function` and are prefixed with a `!` in Twitch chat.

##### If mapped to a string, your bot will respond to the command in chat with that string as a message and the command arguments are ignored

```
commands: {
    test: 'It works!'
}
```

##### Twitch chat usage

```
@MuhName: !test all the things
@MuhBot: It works!
```

##### If mapped to a function, your bot will call that function with the command arguments as an array. The text you return will be sent to the Twitch chat. If you return anything other than a `string`, your bot will not post in the chat. It also supports `Promise` _(see the example below)_.

This command map has a command to fetch image urls from giphy and post them to chat using [request](https://github.com/request/request):

``` 
commands: {
    giphy: function(args) {
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
        });
    }
}
```

##### Twitch chat usage

```
@MuhName: !giphy funky chicken
@MuhBot: http://media4.giphy.com/media/3oGRFBMkvqEzGKtwcw/giphy.gif
```
