var request   = require('request');
var twitchcmd = require('twitchcmd');

var config = {
    name:        'examplebot',
    password:    'oauth:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    channel:     '#example',
    joinMessage: false,
    debug:       true,
    commands: {
        giphy: onGiphy
    }
};

twitchcmd.init(config);

// Handlers

function onGiphy(args) {
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
