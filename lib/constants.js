module.exports = {
    TWITCH_IRC_SERVER: 'irc.chat.twitch.tv',
    TWITCH_IRC_PORT:   443,
    TWTTCH_MEMBERSHIP: 'twitch.tv/membership',
    TWITCH_NAME:       'jtv',
    CHANNEL_REGEX:     /^#/,
    IGNORE_COMMANDS:   {
        rpl_welcome: true,
        rpl_yourhost: true,
        rpl_created: true,
        rpl_myinfo: true,
        rpl_motdstart: true,
        rpl_motd: true,
        rpl_endofmotd: true,
        rpl_namreply: true,
        rpl_endofnames: true,
        JOIN: true,
        PART: true,
        PING: true,
        PONG: true,
        MODE: true,
        PRIVMSG: true,
        CAP: true,
    },
    MODES: {
        ADD_MOD: '+o',
        SUB_MOD: '-o',
    }
};
