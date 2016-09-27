# Twitch Command

Twitch Command is a simple [node-irc](https://github.com/martynsmith/node-irc) client. The purpose of this app is to allow users to easily create custom commands for their twitch channel.

### Prerequisites

- git
- node
- npm
- Twitch account for your bot [create a twitch account here](https://twitch.tv/signup)

### Get the Code

```
$ git clone https://github.com/otothea/node-twitchcmd.git
$ cd node-twitchcmd
$ npm install
```

**NOTE:** npm may throw up an error saying `fatal error: 'unicode/ucsdet.h' file not found` but it is a non-issue for this app

### Create a Config File

```
$ cp config.example.js config.js
```

##### Available config options

- **name** {string} [required] - Your twitch bot username ([create a twitch account here](https://twitch.tv/signup))
- **password** {string} [required] - Your twitch bot *oauth* password (**NOT** your account password, [get your *oauth* password by clicking here](https://twitchapps/tmi))
- **channel** {string} [required] - Your twitch channel name (must include the #)
- **commands** {object} [required] - [Command Map](#command-map)
- **joinMessage** {string} - The message your bot posts to chat when it joins the channel (default: no message)
- **announceUsers** {boolean} - Set to `true` to announce when users join and leave the chat (default: `false`)
- **debug** {boolean} - Set to `true` to turn on debug for the irc client (default: `false`)

### Command Map

Map commands to your bot using the `commands` option in your config.js. Commands can map to a string or a function and are prefixed with a `!` in twitch chat.

##### If mapped to a string, your bot will respond to the command in chat with that string as a message

```
{
    test: 'It works!'
}
```

##### Twitch chat usage

```
@OtotheA: !test
@OtotheBot: It works!
```

##### If mapped to a function, your bot will role a random number between 0 and 100 and call your function with that roll as the first argument. The returned text will be sent to the Twitch chat. If you return nothing, your bot will not post in the chat.

This command map simulates a Rock, Paper, Scissors game and sends a response from your bot:

```
{
    rock: function(roll) {
        roll = Math.round(roll / 100 * 3);
        roll = Math.max(roll - 1, 0);
 
        var outcomes = ['Paper, you lose!', 'Rock, it\'s a tie', 'Scissors, you win!'];
 
        return outcomes[roll];
    },
    paper: function(roll) {
        roll = Math.round(roll / 100 * 3);
        roll = Math.max(roll - 1, 0);
 
        var outcomes = ['Scissors, you lose!', 'Paper, it\'s a tie', 'Rock, you win!'];
 
        return outcomes[roll];
    },
    scissors: function(roll) {
        roll = Math.round(roll / 100 * 3);
        roll = Math.max(roll - 1, 0);
 
        var outcomes = ['Rock, you lose!', 'Scissors, it\'s a tie', 'Paper, you win!'];
 
        return outcomes[roll];
    }
}
```

##### Twitch chat usage

```
@OtotheA: !rock
@OtotheBot: Rock, it's a tie
@OtotheA !rock
@OtotheBot: Paper, you lose!
```

### Run it

```
$ npm start
```

**IMPORTANT:** Don't forget to set your bot as a moderator in your channel
