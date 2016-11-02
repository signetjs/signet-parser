var assert = require('chai').assert;
var approvals = require('./utils/approvals.config');
var parser = require('../index');

function prettyJson(obj) {
    return JSON.stringify(obj, null, 4);
}

describe('parser', function () {

    describe('parseType', function () {
        it('should return a simple type object', function () {
            var result = parser.parseType('int');

            this.verify(prettyJson(result));
        });

        it('should return a type object with subtype info', function () {
            var result = parser.parseType('array<int>');

            this.verify(prettyJson(result));
        });

        it('should not mangle nested subtypes', function () {
            var result = parser.parseType('array<tuple<int>>');

            this.verify(prettyJson(result));
        });

        it('should split subtype strings on semicolons', function () {
            var result = parser.parseType('tuple<string;tuple<string;int>>');

            this.verify(prettyJson(result));
        });

        it('should set optional flag when type is square-bracketed', function () {
            var result = parser.parseType('[tuple<string;tuple<string;int>>]');

            this.verify(prettyJson(result));
        });

        it('should set a name when a value is prepended', function () {
            var result = parser.parseType('test:[tuple<string;tuple<string;int>>]');

            this.verify(prettyJson(result));
        });

    });

    describe('parseSignature', function () {
        
        it('should throw an error if signature contains no arrow', function () {
            var message = 'Signature must contain an output declaration';
            assert.throws(parser.parseSignature.bind(null, 'int'), message);
        });

        it('should parse a correctly formatted signature', function () {
            var signature = 'name:string, definition:tuple<string;tuple<int;int>> => * => tuple<int;int>';
            var result = parser.parseSignature(signature);

            this.verify(prettyJson(result));
        });

    });

});
