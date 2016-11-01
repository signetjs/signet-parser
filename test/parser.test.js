var assert = require('chai').assert;
var approvals = require('./utils/approvals.config');
var parser = require('../index');

function prettyJson (obj) {
    return JSON.stringify(obj, null, 4);
}

describe('parser', function () {

    it('should return a simple type object', function () {
        var result = parser.parse('int');

        this.verify(prettyJson(result));
    });

});
