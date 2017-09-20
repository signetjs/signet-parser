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



    function typeParser(typeStr) {
        var transformedTypeStr = applyMacros(typeLevelMacros, typeStr);

        var typePattern = /^([^:<]+)\:(.+)$/;
        var typeName = transformedTypeStr.replace(typePattern, '$1');
        var rawType = transformedTypeStr.replace(typePattern, '$2');

        return {
            name: typeName === transformedTypeStr ? null : typeName.trim(),
            type: rawType.split('<')[0].replace(/\[|\]/g, '').trim(),
            subtype: parseSubtype(rawType),
            optional: rawType.trim().match(/^\[[^\]]+\]$/) !== null
        };
    }

    function isArray (value) {
        return typeof value === 'object' 
            && value !== null 
            && Object.prototype.toString.call(value) === '[object Array]';
    }

    function copyArray (values) {
        var result = [];
        for(var i = 0; i < values.length; i++) {
            result.push(values[i]);
        }

        return result;
    }

    function copyProps(obj) {
        var keys = Object.keys(obj);
        var result = {};

        for(var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = obj[key];
            
            result[key] = isArray(value) ? copyArray(value) : value;
        }

        return result;
    }

    function copyMemoizerFactory (parser) {
        var memoizedTypes = {};

        return function (typeStr) {
            if(typeof memoizedTypes[typeStr] === 'object') {
                return copyProps(memoizedTypes[typeStr]);
            } else {
                var parsedType = parser(typeStr);
                memoizedTypes[typeStr] = parsedType;
                return copyProps(parsedType);
            }
        }
    }

    var parseType = copyMemoizerFactory(typeParser);

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

    function parseSignature(signature) {
        var resolvedSignature = applyMacros(signatureLevelMacros, signature);
        return splitOnSymbol(isArrow, resolvedSignature).map(parseParams);
    }

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
