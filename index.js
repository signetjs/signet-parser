function signetParser() {
    'use strict';

    var typeLevelMacros = [];
    var signatureLevelMacros = [];

    function throwOnBadMacroResult(result) {
        if (typeof result !== 'string') {
            throw new Error('Macro Error: All macros must return a string; got ' + result + ' of type ' + typeof result);
        }
    }

    function applyMacros(macroSet, typeStr) {
        var result = typeStr;
        var macroLength = macroSet.length;

        for (var i = 0; i < macroLength; i++) {
            result = macroSet[i](result);
            throwOnBadMacroResult(result);
        }

        return result;
    }

    function registerTypeLevelMacro(macro) {
        typeLevelMacros.push(macro);
    }

    function registerSignatureLevelMacro(macro) {
        signatureLevelMacros.push(macro);
    }

    function getSubtypeData(typeStr) {
        var subtypeToken = typeStr.trim().split('<').slice(1).join('<');
        return subtypeToken.substring(0, subtypeToken.length - 1);
    }

    function isSubtypeSeparator(value) {
        return value === ';' || value === ',';
    }

    function parseSubtype(typeStr) {
        var optionalPattern = /^\[(.*)\]$/
        var subtypeData = getSubtypeData(typeStr.trim().replace(optionalPattern, '$1'));
        return splitOnSymbol(isSubtypeSeparator, subtypeData)
            .map(function (value) { return value.trim(); });
    }

    function getColonPosition(typeStr) {
        var colonPosition = -1;
        var lastChar = '';

        for (var i = 0; i < typeStr.length && lastChar !== '<' && colonPosition === -1; i++) {
            lastChar = typeStr[i];
            if (lastChar === ':') {
                colonPosition = i;
            }
        }

        return colonPosition;
    }

    function typeParser(typeStr) {
        var transformedTypeStr = applyMacros(typeLevelMacros, typeStr);

        return {
            type: transformedTypeStr.split('<')[0].replace(/\[|\]/g, '').trim(),
            subtype: parseSubtype(transformedTypeStr),
            optional: transformedTypeStr.trim().match(/^\[[^\]]+\]$/) !== null
        };
    }

    function isObjectInstance(value) {
        return typeof value === 'object' && value !== null;
    }

    function isArray(value) {
        return isObjectInstance(value)
            && Object.prototype.toString.call(value) === '[object Array]';
    }

    function copyArray(values) {
        var result = [];
        for (var i = 0; i < values.length; i++) {
            result.push(copyObjectOrReturn(values[i]));
        }

        result.dependent = isArray(values.dependent)
            ? copyArray(values.dependent)
            : values.dependent;

        return result;
    }

    function copyObjectOrReturn(value) {
        if (isArray(value)) {
            return copyArray(value);
        } else if (isObjectInstance(value)) {
            return copyProps(value);
        } else {
            return value;
        }
    }

    function copyProps(obj) {
        var keys = Object.keys(obj);
        var result = {};

        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = obj[key];

            result[key] = copyObjectOrReturn(value);
        }

        return result;
    }

    function copyMemoizerFactory(parser) {
        var memoizedTypes = {};

        return function (typeStr) {
            var parsedType = memoizedTypes[typeStr];

            if (typeof parsedType === 'undefined') {
                parsedType = parser(typeStr);
                memoizedTypes[typeStr] = parsedType;
            }

            return isArray(parsedType) ? copyArray(parsedType) : copyProps(parsedType);
        }
    }

    var memoizedTypeParser = copyMemoizerFactory(typeParser);

    function parseType(typeStr) {
        var colonPosition = typeStr.indexOf(':') > -1 ? getColonPosition(typeStr) : -1;

        var typeName = colonPosition === -1 ? null : typeStr.substring(0, colonPosition).trim();
        var rawType = typeStr.substring(colonPosition + 1);

        var parsedType = memoizedTypeParser(rawType);

        parsedType.name = typeName;

        return parsedType;
    }

    function parseDependentMetadataToken(metadataStr) {
        var tokens = metadataStr.trim().split(/\s+/g);

        return {
            operator: tokens[1],
            left: tokens[0],
            right: tokens[2]
        }
    }

    function parseDependentMetadata(metadataStr) {
        return metadataStr.split(/\,\s*/g).map(parseDependentMetadataToken);
    }

    function isComma(symbol) {
        return symbol === ',';
    }

    function isDoubleColon(symbol) {
        return symbol === '::';
    }

    function parseParams(token) {
        var tokenSet = splitOnSymbol(isDoubleColon, token);
        var dependentMetadata = tokenSet.length > 1 ? tokenSet.shift() : null;
        var typeValues = splitOnSymbol(isComma, tokenSet[0]).map(parseType);

        typeValues.dependent = dependentMetadata === null ? null : parseDependentMetadata(dependentMetadata);

        return typeValues;
    }

    function bracketStackFactory() {
        var stack = [];

        function update(symbol) {
            if (symbol === '<') {
                stack.push('<');
            }
            if (symbol === '>') {
                stack.pop();
            }
            if (symbol === '::') {
                stack.length = 0;
            }
        }

        return {
            update: update,
            get length() {
                return stack.length;
            }
        };
    }

    function isSequenceChar(symbol) {
        return symbol === '=' ||
            symbol === '%' ||
            symbol === ':';
    }

    function isSpecialSquence(symbol) {
        return symbol[0] === '%' ||
            symbol === '=>' ||
            symbol === '::';
    }

    function splitOnSymbol(isSplitSymbol, signature) {
        var tokens = [];
        var currentToken = '';
        var currentSymbol = '';
        var bracketStack = bracketStackFactory();

        for (var i = 0; i < signature.length; i++) {
            currentSymbol = signature[i];

            if (bracketStack.length === 0 && currentSymbol === '%') {
                i++;
                currentToken += signature[i];
                continue;
            }

            if (isSequenceChar(currentSymbol) && isSpecialSquence(currentSymbol + signature[i + 1])) {
                i++;
                currentSymbol = currentSymbol + signature[i];
            }

            bracketStack.update(currentSymbol);

            if (isSplitSymbol(currentSymbol) && bracketStack.length === 0) {
                tokens.push(currentToken);
                currentToken = '';
                continue;
            }

            currentToken += currentSymbol;
        }

        if (currentToken !== '') {
            tokens.push(currentToken);
        }

        return tokens;
    }

    function isArrow(symbol) {
        return symbol === '=>';
    }

    function signatureParser(signature) {
        var resolvedSignature = applyMacros(signatureLevelMacros, signature);
        return splitOnSymbol(isArrow, resolvedSignature).map(parseParams);
    }

    var parseSignature = copyMemoizerFactory(signatureParser);

    return {
        parseSignature: parseSignature,
        parseType: parseType,
        registerSignatureLevelMacro: registerSignatureLevelMacro,
        registerTypeLevelMacro: registerTypeLevelMacro
    };
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = signetParser;
}
