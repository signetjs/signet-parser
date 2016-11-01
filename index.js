var signetParser = (function () {
    'use strict';

    function parse (typeStr) {
        return {
            'type': typeStr,
            'subtype': []
        };
    }

    return {
        parse: parse
    };
})();

module.exports = signetParser;
