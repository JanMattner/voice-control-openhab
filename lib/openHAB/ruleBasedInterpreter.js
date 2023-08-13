const { items } = require('openhab');

const ExpressionType = {
    SEQUENCE: "sequence",
    COMMAND: "command",
    ALTERNATIVE: "alternative",
    OPTIONAL: "optional",
    ITEMLABEL: "itemlabel",
    ITEMPROPERTIES: "itemproperties",
    LOCATION: "location"
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

function itemProperties(expression, tags = [], locationRequired = true) {
    return {
        expressionType: ExpressionType.ITEMPROPERTIES,
        value: expression,
        tags: tags,
        locationRequired: locationRequired
    }
}

function locationLabel() {
    return {
        expressionType: ExpressionType.LOCATION
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
            case ExpressionType.ITEMPROPERTIES:
                return this.evaluateItemProperties(expression, tokens);
            case ExpressionType.LOCATION:
                return this.evaluateLocation(tokens);
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
     * @param {object} locationItem
     * @returns {object} - exactly the above parameters in an object
     */
    createEvaluationResult(success, remainingTokens, executeFunction, executeParameter, locationItem) {
        return {
            success: success,
            remainingTokens: remainingTokens || [],
            executeFunction: executeFunction,
            executeParameter: executeParameter,
            locationItem: locationItem
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

    evaluateLocation(tokens) {
        console.debug("eval location with tokens: " + stringify(tokens))

        if (tokens.length < 1) {
            console.debug("no tokens, eval location fail")
            return this.createEvaluationResult(false, tokens, null, null);
        }

        let locationItems = this.getItemsBySemanticType(items.getItems(), "Location").filter(item => item.type == "GroupItem");
        
        let matchResult = this.getItemByLabelOrSynonym(locationItems, tokens);

        if (!matchResult) {
            console.debug("eval location fail");
            return this.createEvaluationResult(false, tokens, null, null);
        }

        console.debug("eval location success")
        return this.createEvaluationResult(true, matchResult.remainingTokens, null, null, matchResult.matchedItem);
    }

    evaluateItemProperties(expression, tokens) {
        console.debug("eval item properties with tokens: " + stringify(tokens))
        
        if (tokens.length < 1) {
            console.debug("no tokens, eval item properties fail")
            return this.createEvaluationResult(false, tokens, null, null);
        }

        let expResult = this.evaluateExpression(expression.value, tokens.slice());
        if (!expResult.success) {
            console.debug("eval item properties: inner expression eval fail");
            return this.createEvaluationResult(false, tokens, null, null);
        }

        if (expression.locationRequired && expResult.locationItem == null) {
            console.debug("eval item properties fail: location required but not found");
            return this.createEvaluationResult(false, tokens, null, null);
        }

        let remainingItems = items.getItemsByTag(...expression.tags);
        
        if (expression.locationRequired) {
            remainingItems = remainingItems.filter(item => itemIsInSubGroup(item, expResult.locationItem));
        }

        if (!expResult.executeParameter) {
            expResult.executeParameter = { items: [] };
        }

        if (!expResult.executeParameter.items) {
            expResult.executeParameter.items = [];
        }

        expResult.executeParameter.items = expResult.executeParameter.items.concat(remainingItems);
        return this.createEvaluationResult(true, expResult.remainingTokens, expResult.executeFunction, expResult.executeParameter);
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
            
            if (!parameter.items) {
                console.debug("Trying to send a command, but no items parameter found")
                return;
            }

            parameter.items.forEach(item => {
                item.sendCommand(expression.command); 
            });
        }
        return this.createEvaluationResult(true, result.remainingTokens, executeFunction, result.executeParameter);
    }

    getItemsBySemanticType(itemList, semanticType) {
        return itemList.filter(item => item.semantics.semanticType == semanticType);
    }

    getItemByLabelOrSynonym(itemList, tokens) {
        // normalize and tokenize the label for easier comparison
        let allItems = itemList
            .map(function(i){
                return {
                    item: i,
                    labelTokens: tokenizeUtterance(normalizeUtterance(i.label))
                }
            });

        let checkTokens = function(tokensToCheck, tokensTarget) {
            if (tokensToCheck.length > tokensTarget.length) {
                return false;
            }

            for (let index = 0; index < tokensToCheck.length; index++) {
                if (tokensToCheck[index] != tokensTarget[index]) {
                    return false;
                }
            }
            return true;
        }

        // we need a single exact match
        // first try the regular labels
        let checkLabels = function(remainingItems) {
            let tokenIndex = 0;
            
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

        let matchResult = checkLabels(allItems.slice());

        console.debug("get item by label: found matched labels: " + matchResult.remainingItems.length);

        if (matchResult.remainingItems.length == 0) {
            // either none or multiple matches found. Let's try the synonyms.
            let checkSynonyms = function(allItems) {
                let remainingItems = allItems.map(function(i){
                    return {
                        item: i.item,
                        synonyms: getSynonyms(i.item).map(function(s){ return tokenizeUtterance(normalizeUtterance(s));})
                    }
                });

                // remove items without synonyms
                remainingItems = remainingItems.filter(function(i) {
                    return i.synonyms.length > 0;
                });

                let tokenIndex = 0;
                
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
                    let matchingSynonyms = remainingItems[0].synonyms.filter(function(synonymTokens) {
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

            console.debug("get item by label: found matched synonyms: " + matchResult.remainingItems.length);
        }

        if (matchResult.remainingItems.length == 1) {
            console.debug("get item by label: success");
            return {matchedItem: matchResult.remainingItems[0].item, remainingTokens: tokens.slice(matchResult.tokenIndex)};
        }

        console.debug("get item by label: fail");
        return null;
    }

    evaluateItemLabel(tokens) {
        console.debug("eval item label with tokens: " + stringify(tokens))
        
        if (tokens.length < 1) {
            console.debug("no tokens, eval item label fail")
            return this.createEvaluationResult(false, tokens, null, null);
        }

        let allItems = items.getItems();
        let matchResult = this.getItemByLabelOrSynonym(allItems, tokens);

        if (!matchResult) {
            console.debug("eval item label fail");
            return this.createEvaluationResult(false, tokens, null, null);
        }

        console.debug("eval item label success")
        return this.createEvaluationResult(true, matchResult.remainingTokens, null, {items: [matchResult.matchedItem]});
    }

    evaluateSequence(expression, tokens) {
        console.debug("eval seq: " + stringify(expression));
        var success = true;
        var executeFunction = null;
        var executeParameter = null;
        let locationItem = null;

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
            locationItem = result.locationItem || locationItem;
        }
        
        console.debug("eval seq: " + success)
        return this.createEvaluationResult(success, remainingTokens, executeFunction, executeParameter, locationItem);
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
        let locationItem = null;

        for (var index = 0; index < expression.value.length; index++) {
            var subexp = expression.value[index];
            console.debug("alt index: " + index + "; subexp: " + stringify(subexp));
            var result = this.evaluateExpression(subexp, tokens.slice());
            if (result.success) {
                success = true;
                remainingTokens = result.remainingTokens;
                executeFunction = result.executeFunction || executeFunction;
                executeParameter = result.executeParameter || executeParameter;
                locationItem = result.locationItem || locationItem;
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

function itemIsInSubGroup(item, targetGroupItem) {
    let checkedGroupNames = [];
    let groupStack = [];
    groupStack.push(item);
    while (groupStack.length > 0) {
        let groupItem = groupStack.pop();
        if (groupItem.name == targetGroupItem.name) {
            return true;
        }

        groupItem.groupNames.forEach(groupName => {
            if (!checkedGroupNames.includes(groupName)) {
                checkedGroupNames.push(groupName);
                groupStack.push(items.getItem(groupName));
            }
            
        });
    }

    return false;
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
    itemLabel,
    itemProperties,
    locationLabel
}