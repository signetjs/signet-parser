var signetParser = (function () {
    'use strict';

    function terminateSubtype(bracketStack, currentChar) {
        return (bracketStack.length === 1 && currentChar === ';')
            || (currentChar === '>' && bracketStack.length === 0)
    }

    function charIn(chars, char) {
        var pattern = RegExp('^[' + chars.join('\\') + ']$');
        return char.match(pattern) !== null;
    }

    function captureChar(bracketStack, currentChar) {
        return (bracketStack.length === 0 && currentChar === '>')
            || (bracketStack.length > 0 && !charIn(['<', ';'], currentChar))
            || bracketStack.length > 1;
    }

    function updateStack(bracketStack, currentChar) {
        if (currentChar === '<') {
            bracketStack.push(currentChar);
        } else if (currentChar === '>') {
            bracketStack.pop();
        }
    }

    function buildAppender(bracketStack) {
        return function (subtypeStr, currentChar) {
            var capture = captureChar(bracketStack, currentChar);
            return capture ? subtypeStr + currentChar : subtypeStr;
        };
    }

    function updateSubtypeInfo(bracketStack, subtypeInfo) {
        return function (subtypeStr, currentChar) {
            if (terminateSubtype(bracketStack, currentChar)) {
                subtypeInfo.push(subtypeStr);
            }
        }
    }

    function getUpdatedSubtypeStr(bracketStack, appendOnRule) {
        return function (subtypeStr, currentChar) {
            var terminate = terminateSubtype(bracketStack, currentChar);
            return terminate ? '' : appendOnRule(subtypeStr, currentChar);
        }
    }

    function parseSubtype(typeStr) {
        var subtypeStr = '';
        var subtypeInfo = [];
        var bracketStack = [];

        var getSubtypeStr = getUpdatedSubtypeStr(bracketStack, buildAppender(bracketStack));
        var updateSubtypes = updateSubtypeInfo(bracketStack, subtypeInfo);

        typeStr.split('').forEach(function (currentChar) {
            updateStack(bracketStack, currentChar);
            updateSubtypes(subtypeStr, currentChar);

            subtypeStr = getSubtypeStr(subtypeStr, currentChar);
        });

        return subtypeInfo;
    }

    function parseType(typeStr) {
        var typePattern = /^([^\:]+)\:(.+)$/;
        var typeName = typeStr.replace(typePattern, '$1');
        var rawType = typeStr.replace(typePattern, '$2');

        return {
            name: typeName === typeStr ? null : typeName,
            type: rawType.split('<')[0].replace('[', ''),
            subtype: parseSubtype(rawType),
            optional: rawType.match(/^\[[^\]]+\]$/) !== null
        };
    }

    function parseParams (token){
        return token.split(/\s*\,\s*/).map(parseType);
    }

    function parseSignature(signature) {
        var parameterTokens = signature.split(/\s*\=\>\s*/);

        if (parameterTokens.length < 2) {
            throw new Error('Signature must contain an output declaration');
        }

        return parameterTokens.map(parseParams);
    }

    return {
        parseSignature: parseSignature,
        parseType: parseType
    };
})();

module.exports = signetParser;
