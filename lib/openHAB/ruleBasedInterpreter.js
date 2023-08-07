const { items } = require('openhab');

const ExpressionType = {
    SEQUENCE: "sequence",
    COMMAND: "command",
    ALTERNATIVE: "alternative",
    OPTIONAL: "optional",
    ITEMLABEL: "itemlabel"
};

function alt(params) {
    return {
        expressionType: ExpressionType.ALTERNATIVE,
        value: params || []
    }
}

function seq(params) {
    return {
        expressionType: ExpressionType.SEQUENCE,
        value: params || []
    }
}

function opt(expression) {
    return {
        expressionType: ExpressionType.OPTIONAL,
        value: expression
    }
}

function cmd(expression, command) {
    return {
        expressionType: ExpressionType.COMMAND,
        value: expression,
        command: command
    }
}

function itemLabel() {
    return {
        expressionType: ExpressionType.ITEMLABEL
    }
}

class RuleBasedInterpreter {

    constructor() {
        this.rules = [];
    }

    // ***
    // FUNCTIONS
    // ***

    addRule(expression, executeFunction) {
        this.rules.push({
            expression: expression,
            executeFunction: executeFunction
        });
    }

    clearRules() {
        this.rules = [];
    }

    interpretUtterance(utterance) {
        if (!utterance) {
            return;
        }

        var normalizedUtterance = normalizeUtterance(utterance);
        var tokens = tokenizeUtterance(normalizedUtterance);

        console.debug("input normalized utterance: " + normalizedUtterance);
        console.debug("input tokens: " + stringify(tokens));

        for (var index = 0; index < this.rules.length; index++) {
            console.debug("check rule " + index);
            var rule = this.rules[index];
            console.debug(stringify(rule));
            var result = this.evaluateExpression(rule.expression, tokens.slice());
            if (result.success) {
                var executeFunction = result.executeFunction || rule.executeFunction;
                if (!executeFunction) {
                    console.debug("rule matched, but no function to execute found, continue");
                    continue;
                }

                executeFunction(result.executeParameter);
                break;
            }
        }        
    }

    evaluateExpression(expression, tokens) {
        if (tokens.length < 1) {
            return this.createEvaluationResult(true, tokens, null);
        }

        if (typeof(expression) == "string") {
            return this.evaluateStringExpression(expression, tokens);
        }

        switch (expression.expressionType) {
            case ExpressionType.SEQUENCE:
                return this.evaluateSequence(expression, tokens);
            case ExpressionType.ALTERNATIVE:
                return this.evaluateAlternative(expression, tokens);
            case ExpressionType.OPTIONAL:
                return this.evaluateOptional(expression, tokens);
            case ExpressionType.COMMAND:
                return this.evaluateCommand(expression, tokens);
            case ExpressionType.ITEMLABEL:
                return this.evaluateItemLabel(tokens);
            default:
                return this.createEvaluationResult(false, tokens, null, null);
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
    createEvaluationResult(success, remainingTokens, executeFunction, executeParameter) {
        return {
            success: success,
            remainingTokens: remainingTokens,
            executeFunction: executeFunction,
            executeParameter: executeParameter
        };
    }

    evaluateStringExpression(expression, tokens) {
        if (tokens.length < 1) {
            return this.createEvaluationResult(false, tokens, null, null);
        }

        console.debug("eval string: " + expression)
        console.debug("token: " + tokens[0]);
        var hasMatch = tokens[0] === expression; //tokens[0].match(expression) != null;
        console.debug("hasMatch: " + hasMatch)
        return this.createEvaluationResult(hasMatch, tokens.slice(1), null, null);
    }

    evaluateOptional(expression, tokens) {
        console.debug("eval opt: " + stringify(expression))
        var result = this.evaluateExpression(expression.value, tokens.slice());
        if (result.success) {
            console.debug("eval opt success")
            // only return the reduced token array and other parameters if optional expression was successful.
            return this.createEvaluationResult(true, result.remainingTokens, result.executeFunction, result.executeParameter);
        }
        
        console.debug("eval opt fail")
        // otherwise still return successful, but nothing from the optional expression result
        return this.createEvaluationResult(true, tokens, null, null);
    }

    evaluateCommand(expression, tokens) {
        console.debug("eval cmd: " + stringify(expression.value));
        var result = this.evaluateExpression(expression.value, tokens);
        
        console.debug("eval cmd result: " + result.success)
        if (!result.success) {
            return this.createEvaluationResult(false, tokens, null, null);
        }

        var executeFunction = function(parameter) {
            if (!parameter || typeof(parameter) != "object") {
                console.debug("Trying to send a command, but no proper object parameter found")
                return;
            }
            var item = parameter.item;
            if (!item) {
                console.debug("Trying to send a command, but no item parameter found")
                return;
            }

            item.sendCommand(expression.command);
        }
        return this.createEvaluationResult(true, result.remainingTokens, executeFunction, result.executeParameter);
    }

    evaluateItemLabel(tokens) {
        console.debug("eval item label with tokens: " + stringify(tokens))
        
        if (tokens.length < 1) {
            console.debug("no tokens, eval item label fail")
            return this.createEvaluationResult(false, tokens, null, null);
        }

        // get whole item registry; normalize and tokenize the label for easier comparison
        var allItems = items.getItems()
            .map(function(i){
                return {
                    item: i,
                    labelTokens: tokenizeUtterance(normalizeUtterance(i.label))
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

        console.debug("eval item found matched labels: " + matchResult.remainingItems.length);

        if (matchResult.remainingItems.length == 0) {
            // either none or multiple matches found. Let's try the synonyms.
            var checkSynonyms = function(allItems) {
                var remainingItems = allItems.map(function(i){
                    return {
                        item: i.item,
                        synonyms: getSynonyms(i.item).map(function(s){ return tokenizeUtterance(normalizeUtterance(s));})
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

            console.debug("eval item found matched synonyms: " + matchResult.remainingItems.length);
        }
        

        if (matchResult.remainingItems.length == 1) {
            console.debug("eval item label success")
            return this.createEvaluationResult(true, tokens.slice(matchResult.tokenIndex), null, {item: matchResult.remainingItems[0].item});
        }

        console.debug("eval item label fail")
        return this.createEvaluationResult(false, tokens, null, null);
    }

    evaluateSequence(expression, tokens) {
        console.debug("eval seq: " + stringify(expression));
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
            console.debug("eval subexp " + index + "; subexp: " + stringify(subexp))
            var result = this.evaluateExpression(subexp, remainingTokens);
            if (!result.success) {
                success = false;
                break;
            }

            remainingTokens = result.remainingTokens;
            executeFunction = result.executeFunction || executeFunction;
            executeParameter = result.executeParameter || executeParameter;
        }
        
        console.debug("eval seq: " + success)
        return this.createEvaluationResult(success, remainingTokens, executeFunction, executeParameter);
    }

    evaluateAlternative(expression, tokens) {
        console.debug("eval alt: " + stringify(expression));
        console.debug("for tokens: " + stringify(tokens));
        if (tokens.length < 1) {
            console.debug("eval alt fail")
            // no more tokens left, but at least one sub expression is required
            // -> no match of any alternative possible, we can already abort at this point
            return this.createEvaluationResult(false, tokens, null, null);
        }

        var success = false;
        var executeFunction = null;
        var remainingTokens = tokens;
        var executeParameter = null;

        for (var index = 0; index < expression.value.length; index++) {
            var subexp = expression.value[index];
            console.debug("alt index: " + index + "; subexp: " + stringify(subexp));
            var result = this.evaluateExpression(subexp, tokens.slice());
            if (result.success) {
                success = true;
                remainingTokens = result.remainingTokens;
                executeFunction = result.executeFunction || executeFunction;
                executeParameter = result.executeParameter || executeParameter;
                break;
            }
        }
        
        console.debug("eval alt: " + success)
        return this.createEvaluationResult(success, remainingTokens, executeFunction, executeParameter);
    }
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

function getSynonyms(item) {
    var meta = item.getMetadata("synonyms");
    if (!meta || stringIsNullOrEmpty(meta.value)) {
        return [];
    }

    return meta.value.split(",");
}

// ***
// EXPORTS
// ***

module.exports = {
    RuleBasedInterpreter,
    alt,
    seq,
    opt,
    cmd,
    itemLabel
}