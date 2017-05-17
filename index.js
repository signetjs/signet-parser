function signetParser() {
    'use strict';

    var typeLevelMacros = {};

    function identity (value) {
        return value;
    }

    function applyTypeLeveMacro(typeDef) {
        var typeLevelMacro = typeLevelMacros[typeDef.type];
        typeLevelMacro = typeof typeLevelMacro === 'undefined' ? identity : typeLevelMacro;

        return typeLevelMacro(typeDef);
    }

    function registerTypeLevelMacro (typeKey, macro) {
        if(typeof typeLevelMacros[typeKey] !== 'undefined') {
            throw new Error('Type-level macro "' + typeKey + '" is already registered.');
        }
        
        typeLevelMacros[typeKey] = macro;
    }

    function terminateSubtype(bracketStack, currentChar) {
        return (bracketStack.length === 1 && currentChar === ';')
            || (currentChar === '>' && bracketStack.length === 0);
    }

    function isStructuralChar(char) {
        return char.match(/[\<\;\s]/) !== null;
    }

    function captureChar(bracketStack, currentChar) {
        return bracketStack.length > 1
            || (bracketStack.length === 0 && currentChar === '>')
            || (bracketStack.length > 0 && !isStructuralChar(currentChar));
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
        var typePattern = /^([^:<]+)\:(.+)$/;
        var typeName = typeStr.replace(typePattern, '$1');
        var rawType = typeStr.replace(typePattern, '$2');

        var typeDef = {
            name: typeName === typeStr ? null : typeName.trim(),
            type: rawType.split('<')[0].replace(/\[|\]/g, '').trim(),
            subtype: parseSubtype(rawType),
            optional: rawType.match(/^\[[^\]]+\]$/) !== null
        };

        return applyTypeLeveMacro(typeDef);
    }

    function parseDependentMetadata (metadataStr) {
        var tokens = metadataStr.trim().split(/\s+/g);

        return {
            operator: tokens[1],
            left: tokens[0],
            right: tokens[2]
        }
    }

    function parseParams (token){
        var tokenSet = token.split(/\s*\:\:\s*/);
        var dependentMetadata = tokenSet.length > 1 ? tokenSet.shift() : null;
        var typeValues = tokenSet[0].split(/\s*\,\s*/).map(parseType);

        typeValues.dependent = dependentMetadata === null ? null : parseDependentMetadata(dependentMetadata);

        return typeValues;
    }

    function parseSignature(signature) {
        var parameterTokens = signature.split(/\s*\=\>\s*/);

        return parameterTokens.map(parseParams);
    }

    return {
        parseSignature: parseSignature,
        parseType: parseType,
        registerTypeLevelMacro: registerTypeLevelMacro
    };
}

if(typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = signetParser;
}
