'use strict';

window.myAppConfig = {
    title: 'Call-me',
    name: 'Call-me',
    showGithub: true,
    about: {
        enable: true,
        url: 'https://docs.mirotalk.com/sites/cme.html',
    },

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
    //     },
    //     Sales: {
    //         name: 'Sales',
    //         themeColor: '#b3005e',
    //     },
    // },
    //...
};
