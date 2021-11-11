// HOW TO load this file from a script/rule created in Main UI:
// var OPENHAB_CONF = Java.type('java.lang.System').getenv('OPENHAB_CONF');
// load(OPENHAB_CONF + '/automation/lib/javascript/personal/ruleBasedInterpreter.js');

'use strict';
var isOhEnv = typeof module === "undefined" && typeof require === "undefined";

var utilities;
if (isOhEnv) {
    var OPENHAB_CONF = Java.type('java.lang.System').getenv('OPENHAB_CONF');
    load(OPENHAB_CONF + '/automation/lib/javascript/personal/utilities.js');
} else {
    var u = require("./utilities");
    utilities = u.utilities;
}

function ruleBasedInterpreterMain(context) {
    'use strict';

    var logger;
    if (isOhEnv) {
        logger = Java.type('org.slf4j.LoggerFactory').getLogger('org.openhab.core.automation.ruleBasedInterpreter');    
    } else {
        logger = {
            debug: function() {}
        }
    }
    

    // ***
    // DATA
    // ***
    var expressionTypes = {
        SEQUENCE: "sequence",
        COMMAND: "command",
        ALTERNATIVE: "alternative",
        OPTIONAL: "optional",
        ITEMLABEL: "itemlabel"
    };

    var rules = [];

    // ***
    // FUNCTIONS
    // ***

    function alt(params) {
        return {
            expressionType: expressionTypes.ALTERNATIVE,
            value: params || []
        }
    }

    function seq(params) {
        return {
            expressionType: expressionTypes.SEQUENCE,
            value: params || []
        }
    }

    function opt(expression) {
        return {
            expressionType: expressionTypes.OPTIONAL,
            value: expression
        }
    }

    function cmd(expression, command) {
        return {
            expressionType: expressionTypes.COMMAND,
            value: expression,
            command: command
        }
    }

    function itemLabel() {
        return {
            expressionType: expressionTypes.ITEMLABEL
        }
    }

    function addRule(expression, executeFunction) {
        rules.push({
            expression: expression,
            executeFunction: executeFunction
        });
    }

    function clearRules() {
        rules = [];
    }

    function interpretUtterance(utterance) {
        if (!utterance) {
            return;
        }

        var normalizedUtterance = normalizeUtterance(utterance);
        var tokens = tokenizeUtterance(normalizedUtterance);

        logger.debug("input normalized utterance: " + normalizedUtterance);
        logger.debug("input tokens: " + stringify(tokens));

        for (var index = 0; index < rules.length; index++) {
            logger.debug("check rule " + index);
            var rule = rules[index];
            logger.debug(stringify(rule));
            var result = evaluateExpression(rule.expression, tokens.slice());
            if (result.success) {
                var executeFunction = result.executeFunction || rule.executeFunction;
                if (!executeFunction) {
                    logger.debug("rule matched, but no function to execute found, continue");
                    continue;
                }

                executeFunction(result.executeParameter);
                break;
            }
        }        
    }

    function evaluateExpression(expression, tokens) {
        if (tokens.length < 1) {
            return createEvaluationResult(true, tokens, null);
        }

        if (typeof(expression) == "string") {
            return evaluateStringExpression(expression, tokens);
        }

        switch (expression.expressionType) {
            case expressionTypes.SEQUENCE:
                return evaluateSequence(expression, tokens);
            case expressionTypes.ALTERNATIVE:
                return evaluateAlternative(expression, tokens);
            case expressionTypes.OPTIONAL:
                return evaluateOptional(expression, tokens);
            case expressionTypes.COMMAND:
                return evaluateCommand(expression, tokens);
            case expressionTypes.ITEMLABEL:
                return evaluateItemLabel(tokens);
            default:
                return createEvaluationResult(false, tokens, null, null);
        }
    }

    /**
     * 
     * @param {boolean} success - if evaluation was successful or not
     * @param {string[]} remainingTokens 
     * @param {function} executeFunction - the function to execute in the end 
     * @param {object} executeParameter - the parameter inserted in the executeFunction. Should be a single object that can hold multiple parameters in its key/value pairs.
     * @returns {object} - exactly the above parameters in an object
     */
    function createEvaluationResult(success, remainingTokens, executeFunction, executeParameter) {
        return {
            success: success,
            remainingTokens: remainingTokens,
            executeFunction: executeFunction,
            executeParameter: executeParameter
        };
    }

    function evaluateStringExpression(expression, tokens) {
        if (tokens.length < 1) {
            return createEvaluationResult(false, tokens, null, null);
        }

        logger.debug("eval string: " + expression)
        logger.debug("token: " + tokens[0]);
        var hasMatch = tokens[0] === expression; //tokens[0].match(expression) != null;
        logger.debug("hasMatch: " + hasMatch)
        return createEvaluationResult(hasMatch, tokens.slice(1), null, null);
    }

    function evaluateOptional(expression, tokens) {
        logger.debug("eval opt: " + stringify(expression))
        var result = evaluateExpression(expression.value, tokens.slice());
        if (result.success) {
            logger.debug("eval opt success")
            // only return the reduced token array and other parameters if optional expression was successful.
            return createEvaluationResult(true, result.remainingTokens, result.executeFunction, result.executeParameter);
        }
        
        logger.debug("eval opt fail")
        // otherwise still return successful, but nothing from the optional expression result
        return createEvaluationResult(true, tokens, null, null);
    }

    function evaluateCommand(expression, tokens) {
        logger.debug("eval cmd: " + stringify(expression.value));
        var result = evaluateExpression(expression.value, tokens);
        
        logger.debug("eval cmd result: " + result.success)
        if (!result.success) {
            return createEvaluationResult(false, tokens, null, null);
        }

        var executeFunction = function(parameter) {
            if (!parameter || typeof(parameter) != "object") {
                logger.debug("Trying to send a command, but no proper object parameter found")
                return;
            }
            var item = parameter.item;
            if (!item) {
                logger.debug("Trying to send a command, but no item parameter found")
                return;
            }

            events.sendCommand(item, expression.command);
        }
        return createEvaluationResult(true, result.remainingTokens, executeFunction, result.executeParameter);
    }

    function evaluateItemLabel(tokens) {
        logger.debug("eval item label with tokens: " + stringify(tokens))
        
        if (tokens.length < 1) {
            logger.debug("no tokens, eval item label fail")
            return createEvaluationResult(false, tokens, null, null);
        }

        // get whole item registry; since that's only a Java list, convert it first to a JS array
        // and by that way, normalize and tokenize the label for easier comparison
        var allItems = Java.from(itemRegistry.getItems())
            .map(function(i){
                return {
                    item: i,
                    labelTokens: tokenizeUtterance(normalizeUtterance(i.getLabel()))
                }
            });

        var checkTokens = function(tokensToCheck, tokensTarget) {
            if (tokensToCheck.length > tokensTarget.length) {
                return false;
            }

            for (var index = 0; index < tokensToCheck.length; index++) {
                if (tokensToCheck[index] != tokensTarget[index]) {
                    return false;
                }
            }
            return true;
        }
        // we need a single exact match
        // first try the regular labels
        var checkLables = function(remainingItems) {
            var tokenIndex = 0;
            
            while (remainingItems.length > 1) {
                if (tokens.length < tokenIndex + 1) {
                    // no tokens left, but still multiple possible items -> abort
                    break;
                }
    
                remainingItems = remainingItems.filter(function(entry) {
                    return (entry.labelTokens.length >= tokenIndex + 1) && entry.labelTokens[tokenIndex] == tokens[tokenIndex];
                });
    
                tokenIndex++;
            }

            // if one item is left, ensure that it really has a fully matching label (i.e. each token)
            // because one item could be remaining but not all tokens have been checked to match (e.g. single item in overall registry)
            if (remainingItems.length == 1) {
                if (checkTokens(remainingItems[0].labelTokens, tokens)) {
                    tokenIndex = remainingItems[0].labelTokens.length;
                } else {
                    remainingItems.pop();
                }
            }

            return {remainingItems: remainingItems, tokenIndex: tokenIndex};
        }

        var matchResult = checkLables(allItems.slice());

        logger.debug("eval item found matched labels: " + matchResult.remainingItems.length);

        if (matchResult.remainingItems.length == 0) {
            // either none or multiple matches found. Let's try the synonyms.
            var checkSynonyms = function(allItems) {
                var remainingItems = allItems.map(function(i){
                    return {
                        item: i.item,
                        synonyms: getSynonyms(i.item.getName()).map(function(s){ return tokenizeUtterance(normalizeUtterance(s));})
                    }
                });

                // remove items without synonyms
                remainingItems = remainingItems.filter(function(i) {
                    return i.synonyms.length > 0;
                });

                var tokenIndex = 0;
                
                while (remainingItems.length > 1) {
                    if (tokens.length < tokenIndex + 1) {
                        // no tokens left, but still multiple possible items -> abort
                        break;
                    }
        
                    // remove synonyms with fewer or non-matching tokens
                    remainingItems = remainingItems.map(function(i) {
                        i.synonyms = i.synonyms.filter(function(synonymTokens) {
                            return (synonymTokens.length >= tokenIndex + 1) && (synonymTokens[tokenIndex] == tokens[tokenIndex]);
                        });
                        return i;
                    });
                    
                    // remove items without synonyms
                    remainingItems = remainingItems.filter(function(i) {
                        return i.synonyms.length > 0;
                    });
                    
                    tokenIndex++;
                }

                // if one item is left, ensure that it really has a fully matching synonym (i.e. each token)
                // because one item could be remaining but not all tokens have been checked to match (e.g. single item in overall registry)
                if (remainingItems.length == 1) {
                    var matchingSynonyms = remainingItems[0].synonyms.filter(function(synonymTokens) {
                        return checkTokens(synonymTokens, tokens);
                    });

                    if (matchingSynonyms.length > 0) {
                        tokenIndex = matchingSynonyms[0].length;
                    } else {
                        remainingItems.pop();
                    }
                }

                return {remainingItems: remainingItems, tokenIndex: tokenIndex};
            }

            matchResult = checkSynonyms(allItems.slice());

            logger.debug("eval item found matched synonyms: " + matchResult.remainingItems.length);
        }
        

        if (matchResult.remainingItems.length == 1) {
            logger.debug("eval item label success")
            return createEvaluationResult(true, tokens.slice(matchResult.tokenIndex), null, {item: matchResult.remainingItems[0].item});
        }

        logger.debug("eval item label fail")
        return createEvaluationResult(false, tokens, null, null);
    }

    function getSynonyms(itemName) {
        var meta = utilities.getMetadata(itemName, "synonyms");
        if (!meta || stringIsNullOrEmpty(meta.value)) {
            return [];
        }

        return meta.value.split(",");
    }

    function evaluateSequence(expression, tokens) {
        logger.debug("eval seq: " + stringify(expression));
        var success = true;
        var executeFunction = null;
        var executeParameter = null;

        var remainingTokens = tokens.slice();

        for (var index = 0; index < expression.value.length; index++) {
            var subexp = expression.value[index];
            if (remainingTokens.length < 1) {
                // no more tokens left, but another sub expression is required
                // -> no match of full sequence possible, we can already abort at this point
                var success = false;
                break;
            }
            logger.debug("eval subexp " + index + "; subexp: " + stringify(subexp))
            var result = evaluateExpression(subexp, remainingTokens);
            if (!result.success) {
                success = false;
                break;
            }

            remainingTokens = result.remainingTokens;
            executeFunction = result.executeFunction || executeFunction;
            executeParameter = result.executeParameter || executeParameter;
        }
        
        logger.debug("eval seq: " + success)
        return createEvaluationResult(success, remainingTokens, executeFunction, executeParameter);
    }

    function evaluateAlternative(expression, tokens) {
        logger.debug("eval alt: " + stringify(expression));
        logger.debug("for tokens: " + stringify(tokens));
        if (tokens.length < 1) {
            logger.debug("eval alt fail")
            // no more tokens left, but at least one sub expression is required
            // -> no match of any alternative possible, we can already abort at this point
            return createEvaluationResult(false, tokens, null, null);
        }

        var success = false;
        var executeFunction = null;
        var remainingTokens = tokens;
        var executeParameter = null;

        for (var index = 0; index < expression.value.length; index++) {
            var subexp = expression.value[index];
            logger.debug("alt index: " + index + "; subexp: " + stringify(subexp));
            var result = evaluateExpression(subexp, tokens.slice());
            if (result.success) {
                success = true;
                remainingTokens = result.remainingTokens;
                executeFunction = result.executeFunction || executeFunction;
                executeParameter = result.executeParameter || executeParameter;
                break;
            }
        }
        
        logger.debug("eval alt: " + success)
        return createEvaluationResult(success, remainingTokens, executeFunction, executeParameter);
    }

    function normalizeUtterance(utterance) {
        return utterance.toLowerCase();
    }

    function tokenizeUtterance(utterance) {
        return utterance.split(" ").filter(Boolean);
    }

    function stringify(obj) {
        return JSON.stringify(obj, null, 2);
    }

    function stringIsNullOrEmpty(str) {
        return str === undefined || str === null || str === "";
    }

    // ***
    // EXPORTS
    // ***
    context.ruleBasedInterpreter = {
        interpretUtterance: interpretUtterance,
        alt: alt,
        seq: seq,
        opt: opt,
        cmd: cmd,
        itemLabel: itemLabel,
        addRule: addRule,
        clearRules: clearRules,
        stringIsNullOrEmpty: stringIsNullOrEmpty
    }
}

if (isOhEnv) {
    ruleBasedInterpreterMain(this); 
} else {
    var context = {};
    ruleBasedInterpreterMain(context);
    module.exports = context;
}