# Twitch Bot

### Prerequisites

- git
- node
- npm
- some javascript knowledge

### Get the code

```
$ git clone https://github.com/otothea/node-twitchbot.git
$ cd node-twitchbot
$ npm install
```

### Create a config file

```
$ cp config.example.js config.js
```

##### Available config options

- **name** {string} [required] - Your twitch bot username ([create a twitch account here](https://twitch.tv/signup))
- **password** {string} [required] - Your *oauth* password ([get your oauth password here](https://twitchapps/tmi))
- **channel** {string} [required] - Your twitch channel name (must include the #)
- **commands** {object} [required] - [Command map](#command-map)
- **joinMessage** {string} - The message your bot posts to chat when it joins the channel (default: no message)
- **announceUsers** {boolean} - Set to `true` to announce when users join and leave the chat (default: `false`)

### Command map

Map commands to your bot using the `commands` option in your config.js. Commands can map to a string or a function and are prefixed with a `!` in twitch chat.

##### If mapped to a string, your bot will respond to the command with that string as a message

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

##### If mapped to a function, your bot will role a random number between 0 and 100 and call your function with that roll.

This command map simulates a Rock, Paper, Scissors game response from your bot:

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
