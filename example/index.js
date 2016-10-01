var request   = require('request');
var twitchcmd = require('twitchcmd');

var config = {
    name:        'examplebot',
    password:    'oauth:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    channel:     '#example',
    joinMessage: 'hi',
    debug:       true,
    commands: {
        giphy: onGiphy
    }
};

twitchcmd.init(config);

// Handlers

function onGiphy(args, mod) {
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
                reject(err);
            else if (res.body.data && res.body.data.length)
                resolve(res.body.data[0].images.original.url);
            else
                resolve();
        });
    }).catch(console.error);
}
