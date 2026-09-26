'use strict';

window.myAppConfig = {
    title: 'Call-me',
    name: 'Call-me',
    showGithub: true,
    about: {
        enable: true,
        url: 'https://docs.mirotalk.com/sites/cme',
    },

    // Optional room-full dialog overrides. Omitted values use the current locale.
    // Use __limit__ in the message to show the configured participant limit.
    // roomFull: {
    //     title: 'Room is full',
    //     message: 'This room allows up to __limit__ participants.',
    //     action: 'Choose another room',
    //     url: '/',
    // },

    // Optional per-room visual overrides (branding only, NOT security).
    // Keys are room names (as used in ?room=Name). Any omitted field falls
    // back to the global default above. Rooms without an entry are unchanged.
    // rooms: {
    //     Support: {
    //         title: 'Support',
    //         name: 'Support',
    //         subtitle: 'We are here to help',
    //         themeColor: '#0a7d3c',
    //         showGithub: false,
    //         roomFull: {
    //             title: 'All support agents are busy',
    //             message: 'This support room allows up to __limit__ participants.',
    //             action: 'Try another room',
    //             url: 'https://example.com/support',
    //         },
    //     },
    //     Sales: {
    //         name: 'Sales',
    //         themeColor: '#b3005e',
    //     },
    // },
    //...
};
