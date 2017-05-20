function signetParser() {
    'use strict';

    var typeLevelMacros = [];

    function identity(value) {
        return value;
    }

    function throwOnBadMacroResult(result) {
        if (typeof result !== 'string') {
            throw new Error('Macro Error: All macros must return a string; got ' + result + ' of type ' + typeof result);
        }
    }

    function applyTypeLeveMacros(typeStr) {
        var result = typeStr;
        var macroLength = typeLevelMacros.length;

        for (var i = 0; i < macroLength; i++) {
            result = typeLevelMacros[i](result);
            throwOnBadMacroResult(result);
        }

        return result;
    }

    function registerTypeLevelMacro(macro) {
        typeLevelMacros.push(macro);
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

        var typeStringTokens = typeStr.split('');

        for(var i = 0; i < typeStringTokens.length; i++) {
            var currentChar = typeStringTokens[i];

            if(currentChar === '%') {
                i++;
                subtypeStr += typeStringTokens[i];
                continue;
            }

            updateStack(bracketStack, currentChar);
            updateSubtypes(subtypeStr, currentChar);

            subtypeStr = getSubtypeStr(subtypeStr, currentChar);
        }

        return subtypeInfo;
    }

    function parseType(typeStr) {
        var transformedTypeStr = applyTypeLeveMacros(typeStr);

        var typePattern = /^([^:<]+)\:(.+)$/;
        var typeName = transformedTypeStr.replace(typePattern, '$1');
        var rawType = transformedTypeStr.replace(typePattern, '$2');

        return {
            name: typeName === transformedTypeStr ? null : typeName.trim(),
            type: rawType.split('<')[0].replace(/\[|\]/g, '').trim(),
            subtype: parseSubtype(rawType),
            optional: rawType.match(/^\[[^\]]+\]$/) !== null
        };
    }

    function parseDependentMetadataToken(metadataStr) {
        var tokens = metadataStr.trim().split(/\s+/g);

        return {
            operator: tokens[1],
            left: tokens[0],
            right: tokens[2]
        }
    }

    function parseDependentMetadata (metadataStr) {
        return metadataStr.split(/\,\s*/g).map(parseDependentMetadataToken);
    }

    function parseParams(token) {
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

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = signetParser;
}
