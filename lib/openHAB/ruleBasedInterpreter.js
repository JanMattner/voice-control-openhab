// ==== YAML RULE TEMPLATE START ====
const { items } = require('openhab');
let logger = require('openhab').log('cuevox');

class Expression {
    /**
     * @param {string[]} tokens
     * @returns {EvaluationResult}
     */
    evaluate(tokens) {
        return new EvaluationResult(false, tokens);
    }
    
    checkAndNormalizeExpression(expression) {
        if (typeof expression === 'string') {
            let tokens = tokenizeUtterance(normalizeString(expression));
            if (tokens.length == 0) {
                logger.warn(`Empty expression found after normalizing: ${expression}`);
                return "";
            } else if (tokens.length > 1) {
                logger.warn(`Found expression with multiple tokens, only 1 token is supported: ${expression}`);
            }

            return tokens[0];
        }

        return expression;
    }
}

class MultiExpression extends Expression {
    /**
     * @param  {...Expression} expressions
     */
    constructor(...expressions) {
        super();
        this.multiExpressions = expressions.map(expr => this.checkAndNormalizeExpression(expr));
    }
}

class SingleExpression extends Expression {
    /**
     * @param {Expression} expression
     */
    constructor(expression) {
        super();
        this.singleExpression = this.checkAndNormalizeExpression(expression);
    }
}

/**
 * Creates an alternative expression. All given expressions can be used alternatively, i.e. using an OR logic.
 * @param  {...Expression} expressions Any expression types.
 */
function alt(...expressions) {return new AlternativeExp(...expressions);}
class AlternativeExp extends MultiExpression {
    evaluate(tokens) {
        logger.debug("eval alt: " + stringify(this.multiExpressions));
        logger.debug("for tokens: " + stringify(tokens));

        var success = false;
        var executeFunction = null;
        var remainingTokens = tokens;
        var executeParameter = null;
        let groupItem = null;

        for (var index = 0; index < this.multiExpressions.length; index++) {
            var subexp = this.multiExpressions[index];
            logger.debug("alt index: " + index + "; subexp: " + stringify(subexp));
            var result = evaluateExpressionOrString(subexp, tokens.slice());
            if (result.success) {
                success = true;
                remainingTokens = result.remainingTokens;
                executeFunction = result.executeFunction || executeFunction;
                executeParameter = result.executeParameter || executeParameter;
                groupItem = result.groupItem || groupItem;
                break;
            }
        }

        logger.debug("eval alt: " + success)
        return new EvaluationResult(success, remainingTokens, executeFunction, executeParameter);
    }
}

/**
 * Creates a sequential expression. All given expressions are processed sequentially in that order.
 * @param  {...Expression} expressions Any expression types.
 */
function seq(...expressions) {return new SequenceExp(...expressions);}
class SequenceExp extends MultiExpression {
    evaluate(tokens) {
        logger.debug("eval seq: " + stringify(this.multiExpressions));
        var success = true;
        var executeFunction = null;
        var executeParameter = null;
        let groupItem = null;

        var remainingTokens = tokens.slice();

        for (var index = 0; index < this.multiExpressions.length; index++) {
            var subexp = this.multiExpressions[index];
            logger.debug("eval subexp " + index + "; subexp: " + stringify(subexp))
            var result = evaluateExpressionOrString(subexp, remainingTokens);
            if (!result.success) {
                logger.debug("eval subexp " + index + "failed");
                success = false;
                break;
            }

            remainingTokens = result.remainingTokens;
            executeFunction = result.executeFunction || executeFunction;
            executeParameter = result.executeParameter || executeParameter;
            groupItem = result.groupItem || groupItem;
        }

        logger.debug("eval seq: " + success)
        return new EvaluationResult(success, remainingTokens, executeFunction, executeParameter, groupItem);
    }
}

/**
 * Creates an optional expression. The given expression is not mandatory for a match.
 * @param  {Expression} expression
 */
function opt(expression) {return new OptionalExp(expression);}
class OptionalExp extends SingleExpression {
    evaluate(tokens) {
        logger.debug("eval opt: " + stringify(this.singleExpression))
        var result = evaluateExpressionOrString(this.singleExpression, tokens.slice());
        if (result.success) {
            logger.debug("eval opt success")
            // only return the reduced token array and other parameters if optional expression was successful.
            return new EvaluationResult(true, result.remainingTokens, result.executeFunction, result.executeParameter);
        }

        logger.debug("eval opt fail")
        // otherwise still return successful, but nothing from the optional expression result
        return new EvaluationResult(true, tokens, null, null);
    }
}

/**
 * Creates a command expression.
 * If the given expression is matched, the given command is sent to all found items of that rule.
 * @param {Expression} expression
 * @param {string} command
 */
function cmd(expression, command) {return new CommandExp(expression, command);}
class CommandExp extends SingleExpression {
    /**
     * @param {Expression} expression
     * @param {string} command
     */
    constructor(expression, command) {
        super(expression);
        this.command = command;
    }

    evaluate(tokens) {
        logger.debug("eval cmd: " + stringify(this.singleExpression));
        var result = evaluateExpressionOrString(this.singleExpression, tokens);

        logger.debug("eval cmd result: " + result.success)
        if (!result.success) {
            return new EvaluationResult(false, tokens, null, null);
        }

        let commandToExecute = this.command;

        var executeFunction = function(parameter) {
            if (!parameter || typeof(parameter) != "object") {
                logger.debug("Trying to send a command, but no proper object parameter found")
                return;
            }

            if (!parameter.items) {
                logger.debug("Trying to send a command, but no items parameter found")
                return;
            }

            parameter.items.forEach(item => {
                item.sendCommand(commandToExecute);
            });
        }
        return new EvaluationResult(true, result.remainingTokens, executeFunction, result.executeParameter);
    }
}

/**
 * Creates an item label expression.
 * It will try to match an item's label or its synonyms to the tokens at this point.
 * Only a single item must be matched.
 * The found item can be included in the final execution parameter, e.g. to send a command to that item.
 * @param {boolean} includeInExecuteParameter   Default: true.
 * @param {boolean} isGroup                     Default: false. If true, only group items (type: "Group") are matched.
 * @returns
 */
function itemLabel(includeInExecuteParameter, isGroup) {return new ItemLabelExp(includeInExecuteParameter, isGroup);}
class ItemLabelExp extends Expression {
    /**
     * @param {boolean} includeInExecuteParameter   Default: true.
     * @param {boolean} isGroup                  Default: false.
     */
    constructor(includeInExecuteParameter, isGroup) {
        super();
        this.isGroup = isGroup ??= null;
        this.includeInExecuteParameter = includeInExecuteParameter ??= true;
    }

    evaluate(tokens) {
        logger.debug("eval item label with tokens: " + stringify(tokens))

        if (tokens.length < 1) {
            logger.debug("no tokens, eval item label fail")
            return new EvaluationResult(false, tokens, null, null);
        }

        let remainingItems = items.getItems();
        if (this.isGroup != null) {
            remainingItems = remainingItems.filter(item => item.type === "Group");
        }

        let matchResult = getItemByLabelOrSynonym(remainingItems, tokens);

        if (!matchResult) {
            logger.debug("eval item label fail");
            return new EvaluationResult(false, tokens, null, null);
        }

        logger.debug("eval item label success")
        let groupItem = null;
        if (this.isGroup) {
            groupItem = matchResult.matchedItem;
        }

        let executeParameter = null;
        if (this.includeInExecuteParameter) {
            executeParameter = {items: [matchResult.matchedItem]};
        }

        return new EvaluationResult(true, matchResult.remainingTokens, null, executeParameter, groupItem);
    }
}

/**
 * Creates an item properties expression.
 * It tries to filter items according to their properties: tags, item type or parent group.
 * If none of filter properties are given, then all items in the registry will be matched.
 * All matched items will be included in the final execution parameter, e.g. to send a command to these items.
 * @param {Expression} expression   The expression to match.
 * @param {string[]} tags           Default: []. Only items that have all the given tags will be matched.
 * @param {boolean} groupRequired   Default: true. If true, the expression must contain a group Item Label Expression. Only descendants of that group will be matched.
 * @param {string} itemType         Default: null. If a type is given, then only items of that type will be matched.
 */
function itemProperties(expression, tags, groupRequired, itemType) {return new ItemPropertiesExp(expression, tags, groupRequired, itemType);}
class ItemPropertiesExp extends SingleExpression {
    /**
     * @param {Expression} expression
     * @param {string[]} tags
     * @param {boolean} groupRequired
     * @param {string} itemType
     */
    constructor(expression, tags, groupRequired, itemType) {
        super(expression);
        this.tags = tags ??= [];
        this.groupRequired = groupRequired ??= true;
        this.itemType = itemType ??= null;
    }

    evaluate(tokens) {
        logger.debug("eval item properties with tokens: " + stringify(tokens))

        if (tokens.length < 1) {
            logger.debug("no tokens, eval item properties fail")
            return new EvaluationResult(false, tokens, null, null);
        }

        let expResult = evaluateExpressionOrString(this.singleExpression, tokens.slice());
        if (!expResult.success) {
            logger.debug("eval item properties: inner expression eval fail");
            return new EvaluationResult(false, tokens, null, null);
        }

        if (this.groupRequired && expResult.groupItem == null) {
            logger.debug("eval item properties fail: group required but not found");
            return new EvaluationResult(false, tokens, null, null);
        }

        logger.debug("eval item properties: search items");

        let remainingItems = null;
        if (this.tags.length == 0) {
            remainingItems = items.getItems();
            logger.debug("eval item properties: get all items");
        } else {
            remainingItems = items.getItemsByTag(...this.tags);
            logger.debug("eval item properties: filter items by tags: " + this.tags + "; remaining: " + remainingItems.length);
        }

        if (this.itemType != null) {
            remainingItems = remainingItems.filter(item => item.type == this.itemType);
            logger.debug("eval item properties: filter items by type: " + this.itemType + "; remaining: " + remainingItems.length);
        }

        if (this.groupRequired) {
            remainingItems = remainingItems.filter(item => itemIsInSubGroup(item, expResult.groupItem));
            logger.debug("eval item properties: filter items by group: " + expResult.groupItem.name + "; remaining: " + remainingItems.length);
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
     * @param {boolean} success             if evaluation was successful or not
     * @param {string[]} remainingTokens
     * @param {function} executeFunction    the function to execute in the end
     * @param {object} executeParameter     the parameter inserted in the executeFunction. Should be a single object that can hold multiple parameters in its key/value pairs.
     * @param {object} groupItem
     */
    constructor(success, remainingTokens, executeFunction, executeParameter, groupItem) {
        this.success = success;
        this.remainingTokens = remainingTokens || [];
        this.executeFunction = executeFunction;
        this.executeParameter = executeParameter;
        this.groupItem = groupItem;
    }
}

class AnnotationResult {
    /**
     *
     * @param {boolean} success             if evaluation was successful or not
     * @param {string} input                the original user input
     * @param {string[]} remainingTokens
     * @param {string} executeFunction      the function name or its source
     * @param {object} executeParameter     the parameter inserted in the executeFunction. Should be a single object that can hold multiple parameters in its key/value pairs.
     */
    constructor(success, input, remainingTokens, executeFunction, executeParameter) {
        this.success = success;
        this.input = input || "";
        this.remainingTokens = remainingTokens || [];
        this.executeFunction = executeFunction;
        this.executeParameter = executeParameter;
    }
}

class RuleBasedInterpreter {
    constructor() {
        this.rules = [];
    }

    // ***
    // FUNCTIONS
    // ***

    /**
     * Adds a rule.
     * Either the expression must contain a function to execute (e.g. send a command) or a specific function must be given.
     * @param {Expression} expression
     * @param {function} executeFunction    If a specific function is given, it will override any function from the expression.
     */
    addRule(expression, executeFunction) {
        this.rules.push({
            expression: expression,
            executeFunction: executeFunction
        });
    }

    /**
     * Clears all saved rules.
     */
    clearRules() {
        this.rules = [];
    }

    /**
     * Tries to interpret the given utterance by matching all saved rules.
     * @param {string} utterance
     * @returns ${AnnotationResult}
     */
    interpretUtterance(utterance) {
        var result = new EvaluationResult(false, [], null);

        if (!utterance) {
            return;
        }

        var normalizedUtterance = normalizeString(utterance);
        var tokens = tokenizeUtterance(normalizedUtterance);
        result.remainingTokens = tokens;

        logger.debug("input normalized utterance: " + normalizedUtterance);
        logger.debug("input tokens: " + stringify(tokens));

        for (var index = 0; index < this.rules.length; index++) {
            logger.debug("check rule " + index);
            var rule = this.rules[index];
            logger.debug(stringify(rule));
            result = evaluateExpressionOrString(rule.expression, tokens.slice());
            if (result.success) {
                result.executeFunction = result.executeFunction || rule.executeFunction;
                if (!result.executeFunction) {
                    logger.debug("rule matched, but no function to execute found, continue");
                    continue;
                }

                result.success = result.executeFunction(result.executeParameter);
                break;
            }
        }

        return annotateResult(result, normalizedUtterance);
    }
}

/**
 * Convert EvaluationResult to AnnotationResult
 * @param {EvaluationResult} result
 * @param {string} input
 * @returns {AnnotationResult}
 */
function annotateResult(result, input) {
    var annotation = new AnnotationResult(
        result.success,
        input,
        result.remainingTokens,
        "",
        result.executeParameter
    );

    if(!result.executeFunction) {
        return annotation;
    }

    if(!result.executeFunction.name) {
        annotation.executeFunction = result.executeFunction.toString();
    }
    else {
        annotation.executeFunction = result.executeFunction.name;
    }

    return annotation;
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

    logger.debug("eval string: " + expression)
    logger.debug("token: " + tokens[0]);
    var hasMatch = tokens[0] === expression; //tokens[0].match(expression) != null;
    logger.debug("hasMatch: " + hasMatch)
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
                labelTokens: tokenizeUtterance(normalizeString(i.label))
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

    logger.debug("get item by label: found matched labels: " + matchResult.remainingItems.length);

    if (matchResult.remainingItems.length == 0) {
        // either none or multiple matches found. Let's try the synonyms.
        let checkSynonyms = function(allItems) {
            let remainingItems = allItems.map(function(i){
                return {
                    item: i.item,
                    synonyms: getSynonyms(i.item).map(function(s){ return tokenizeUtterance(normalizeString(s));})
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

        logger.debug("get item by label: found matched synonyms: " + matchResult.remainingItems.length);
    }

    if (matchResult.remainingItems.length == 1) {
        logger.debug("get item by label: success");
        return {matchedItem: matchResult.remainingItems[0].item, remainingTokens: tokens.slice(matchResult.tokenIndex)};
    }

    logger.debug("get item by label: fail");
    return null;
}

function normalizeString(str) {
    // allow only unicode letters, apostrophes and spaces
    return str.toLowerCase().replace(/[^\p{L}' ]/gu, "");
}

function tokenizeUtterance(utterance) {
    return utterance.split(" ").filter(token => token !== "");
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

// ==== YAML RULE TEMPLATE END ====

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