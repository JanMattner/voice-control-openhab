const { items } = require('openhab');

class Expression {
    /**
     * @param {string[]} tokens 
     * @returns {EvaluationResult}
     */
    evaluate(tokens) {
        return new EvaluationResult(false, tokens);
    }
}

/**
 * @param  {...Expression} expressions 
 */
function alt(...expressions) {return new AlternativeExp(...expressions);}
class AlternativeExp extends Expression {
    /**
     * @param  {...Expression} expressions 
     */
    constructor(...expressions) {
        super();
        this.value = expressions;
    }

    evaluate(tokens) {
        console.debug("eval alt: " + stringify(this.value));
        console.debug("for tokens: " + stringify(tokens));

        var success = false;
        var executeFunction = null;
        var remainingTokens = tokens;
        var executeParameter = null;
        let locationItem = null;

        for (var index = 0; index < this.value.length; index++) {
            var subexp = this.value[index];
            console.debug("alt index: " + index + "; subexp: " + stringify(subexp));
            var result = evaluateExpressionOrString(subexp, tokens.slice());
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
        return new EvaluationResult(success, remainingTokens, executeFunction, executeParameter);
    }
}

/**
 * @param  {...Expression} expressions 
 */
function seq(...expressions) {return new SequenceExp(...expressions);}
class SequenceExp extends Expression {
    /**
     * @param  {...Expression} expressions 
     */
    constructor(...expressions) {
        super();
        this.value = expressions;
    }

    evaluate(tokens) {
        console.debug("eval seq: " + stringify(this.value));
        var success = true;
        var executeFunction = null;
        var executeParameter = null;
        let locationItem = null;

        var remainingTokens = tokens.slice();

        for (var index = 0; index < this.value.length; index++) {
            var subexp = this.value[index];
            console.debug("eval subexp " + index + "; subexp: " + stringify(subexp))
            var result = evaluateExpressionOrString(subexp, remainingTokens);
            if (!result.success) {
                console.debug("eval subexp " + index + "failed");
                success = false;
                break;
            }

            remainingTokens = result.remainingTokens;
            executeFunction = result.executeFunction || executeFunction;
            executeParameter = result.executeParameter || executeParameter;
            locationItem = result.locationItem || locationItem;
        }
        
        console.debug("eval seq: " + success)
        return new EvaluationResult(success, remainingTokens, executeFunction, executeParameter, locationItem);
    }
}

/**
 * @param  {...Expression} expressions 
 */
function opt(...expression) {return new OptionalExp(...expression);}
class OptionalExp extends Expression {
    /**
     * 
     * @param {Expression} expression 
     */
    constructor(expression) {
        super();
        this.value = expression;
    }

    evaluate(tokens) {
        console.debug("eval opt: " + stringify(this.value))
        var result = evaluateExpressionOrString(this.value, tokens.slice());
        if (result.success) {
            console.debug("eval opt success")
            // only return the reduced token array and other parameters if optional expression was successful.
            return new EvaluationResult(true, result.remainingTokens, result.executeFunction, result.executeParameter);
        }
        
        console.debug("eval opt fail")
        // otherwise still return successful, but nothing from the optional expression result
        return new EvaluationResult(true, tokens, null, null);
    }
}

/**
 * @param {Expression} expression 
 * @param {string} command 
 */
function cmd(expression, command) {return new CommandExp(expression, command);}
class CommandExp extends Expression {
    /**
     * @param {Expression} expression 
     * @param {string} command 
     */
    constructor(expression, command) {
        super();
        this.value = expression;
        this.command = command;
    }

    evaluate(tokens) {
        console.debug("eval cmd: " + stringify(this.value));
        var result = evaluateExpressionOrString(this.value, tokens);
        
        console.debug("eval cmd result: " + result.success)
        if (!result.success) {
            return new EvaluationResult(false, tokens, null, null);
        }

        let commandToExecute = this.command;

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
                item.sendCommand(commandToExecute); 
            });
        }
        return new EvaluationResult(true, result.remainingTokens, executeFunction, result.executeParameter);
    }
}

function itemLabel(includeInExecuteParameter, isLocation) {return new ItemLabelExp(includeInExecuteParameter, isLocation);}
class ItemLabelExp extends Expression {
    /**
     * @param {boolean} includeInExecuteParameter
     * @param {boolean} isLocation 
     */
    constructor(includeInExecuteParameter, isLocation) {
        super();
        this.isLocation = isLocation ??= null;
        this.includeInExecuteParameter = includeInExecuteParameter ??= true;
    }

    evaluate(tokens) {
        console.debug("eval item label with tokens: " + stringify(tokens))
        
        if (tokens.length < 1) {
            console.debug("no tokens, eval item label fail")
            return new EvaluationResult(false, tokens, null, null);
        }

        let remainingItems = items.getItems();
        if (this.isLocation != null) {
            remainingItems = remainingItems.filter(item => item.semantics.isLocation == this.isLocation);
        }

        let matchResult = getItemByLabelOrSynonym(remainingItems, tokens);

        if (!matchResult) {
            console.debug("eval item label fail");
            return new EvaluationResult(false, tokens, null, null);
        }

        console.debug("eval item label success")
        let locationItem = null;
        if (this.isLocation) {
            locationItem = matchResult.matchedItem;
        }

        let executeParameter = null;
        if (this.includeInExecuteParameter) {
            executeParameter = {items: [matchResult.matchedItem]};
        }

        return new EvaluationResult(true, matchResult.remainingTokens, null, executeParameter, locationItem);
    }
}

/**
 * @param {Expression} expression 
 * @param {string[]} tags 
 * @param {boolean} locationRequired 
 * @param {string} itemType
 */
function itemProperties(expression, tags, locationRequired, itemType) {return new ItemPropertiesExp(expression, tags, locationRequired, itemType);}
class ItemPropertiesExp extends Expression {
    /**
     * @param {Expression} expression 
     * @param {string[]} tags 
     * @param {boolean} locationRequired 
     */
    constructor(expression, tags, locationRequired, itemType) {
        super();
        this.value = expression;
        this.tags = tags ??= [];
        this.locationRequired = locationRequired ??= true;
        this.itemType = itemType ??= null;
    }

    evaluate(tokens) {
        console.debug("eval item properties with tokens: " + stringify(tokens))
        
        if (tokens.length < 1) {
            console.debug("no tokens, eval item properties fail")
            return new EvaluationResult(false, tokens, null, null);
        }

        let expResult = evaluateExpressionOrString(this.value, tokens.slice());
        if (!expResult.success) {
            console.debug("eval item properties: inner expression eval fail");
            return new EvaluationResult(false, tokens, null, null);
        }

        if (this.locationRequired && expResult.locationItem == null) {
            console.debug("eval item properties fail: location required but not found");
            return new EvaluationResult(false, tokens, null, null);
        }

        console.debug("eval item properties: search items");

        let remainingItems = null;
        if (this.tags.length == 0) {
            remainingItems = items.getItems();
            console.debug("eval item properties: get all items");
        } else {
            remainingItems = items.getItemsByTag(...this.tags);
            console.debug("eval item properties: filter items by tags: " + this.tags + "; remaining: " + remainingItems.length);
        }

        if (this.itemType != null) {
            remainingItems = remainingItems.filter(item => item.type == this.itemType);
            console.debug("eval item properties: filter items by type: " + this.itemType + "; remaining: " + remainingItems.length);
        }
        
        if (this.locationRequired) {
            remainingItems = remainingItems.filter(item => itemIsInSubGroup(item, expResult.locationItem));
            console.debug("eval item properties: filter items by location: " + expResult.locationItem.name + "; remaining: " + remainingItems.length);
        }

        if (!expResult.executeParameter) {
            expResult.executeParameter = { items: [] };
        }

        if (!expResult.executeParameter.items) {
            expResult.executeParameter.items = [];
        }

        expResult.executeParameter.items = expResult.executeParameter.items.concat(remainingItems);
        return new EvaluationResult(true, expResult.remainingTokens, expResult.executeFunction, expResult.executeParameter);
    }
}

class EvaluationResult {
    /**
     * 
     * @param {boolean} success - if evaluation was successful or not
     * @param {string[]} remainingTokens 
     * @param {function} executeFunction - the function to execute in the end 
     * @param {object} executeParameter - the parameter inserted in the executeFunction. Should be a single object that can hold multiple parameters in its key/value pairs.
     * @param {object} locationItem
     */
    constructor(success, remainingTokens, executeFunction, executeParameter, locationItem) {
        this.success = success;
        this.remainingTokens = remainingTokens || [];
        this.executeFunction = executeFunction;
        this.executeParameter = executeParameter;
        this.locationItem = locationItem;
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
            var result = evaluateExpressionOrString(rule.expression, tokens.slice());
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

    
}

/**
 * 
 * @param {Expression} expression 
 * @param {string[]} tokens 
 * @returns {EvaluationResult}
 */
function evaluateExpressionOrString(expression, tokens) {
    if (tokens.length < 1) {
        return new EvaluationResult(true, tokens, null);
    }

    if (typeof(expression) == "string") {
        return evaluateStringExpression(expression, tokens);
    }

    return expression.evaluate(tokens);
}

function evaluateStringExpression(expression, tokens) {
    if (tokens.length < 1) {
        return new EvaluationResult(false, tokens, null, null);
    }

    console.debug("eval string: " + expression)
    console.debug("token: " + tokens[0]);
    var hasMatch = tokens[0] === expression; //tokens[0].match(expression) != null;
    console.debug("hasMatch: " + hasMatch)
    return new EvaluationResult(hasMatch, tokens.slice(1), null, null);
}

function getItemsBySemanticType(itemList, semanticType) {
    return itemList.filter(item => item.semantics.semanticType == semanticType);
}

function getItemByLabelOrSynonym(itemList, tokens) {
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
    itemProperties
}