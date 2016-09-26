module.exports = {
    name:          'MuhBot',
    password:      'oauth:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    channel:       '#muh',
    joinMessage:   'Hello world!',
    announceUsers: true,
    commands: {
        test: 'It works!',
        roll: function(roll) {
            return roll;
        }
    }
};
