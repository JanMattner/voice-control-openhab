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
        this.isGroup = isGroup ?? null;
        this.includeInExecuteParameter = includeInExecuteParameter ??= true;
    }

    evaluate(tokens) {
        logger.debug("eval item label with tokens: " + stringify(tokens))

        if (tokens.length < 1) {
            logger.debug("no tokens, eval item label fail")
            return new EvaluationResult(false, tokens, null, null);
        }

        let remainingItems = items.getItems();
        // Only filter for groups when explicitly requested (true). If isGroup is false or null, don't filter.
        if (this.isGroup === true) {
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

/**
 * Find an item by exact label or synonym match against the start of the given tokens.
 *
 * Contract (current behavior):
 * - Only exact matches (label or synonyms) are considered.
 * - For each item we determine the shortest exact match length (number of tokens) it
 *   provides for the given input tokens (from label or any synonym).
 * - The function selects the single item whose shortest exact match length is the
 *   smallest among all items. If multiple items share the same smallest length the
 *   result is considered ambiguous and the function returns null.
 * - The returned remainingTokens slice corresponds to tokens after consuming the
 *   matched label/synonym (i.e. tokens.slice(matchLength)).
 *
 * Note on backtracking: an alternative strategy would be to prefer the shortest
 * match but automatically backtrack to longer matches if the rest of the expression
 * (following tokens) fails to match. That would require adding a backtracking
 * mechanism across expression evaluation and is more invasive; it may be implemented
 * in the future if needed. For now we keep the simpler, deterministic shortest-match
 * contract described above.
 */
// --- Matching helpers -----------------------------------------------------

function tokenizeNormalized(str) {
    return tokenizeUtterance(normalizeString(str || ""));
}

function checkTokens(tokensToCheck, tokensTarget) {
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

function getSynonymTokens(item) {
    // Returns an array of token arrays for each synonym. Handles missing metadata.
    try {
        const syns = getSynonyms(item);
        return syns.map(s => tokenizeNormalized(s));
    } catch (e) {
        logger.warn("Failed to get synonyms for item " + (item && item.name));
        return [];
    }
}

function shortestExactMatchForItem(item, tokens) {
    const labelTokens = tokenizeNormalized(item.label);
    let shortest = null;

    if (labelTokens.length > 0 && checkTokens(labelTokens, tokens)) {
        shortest = { matchLength: labelTokens.length, source: 'label', matchedTokens: labelTokens };
    }

    const synTokens = getSynonymTokens(item);
    synTokens.forEach(st => {
        if (st.length > 0 && checkTokens(st, tokens)) {
            if (!shortest || st.length < shortest.matchLength) {
                shortest = { matchLength: st.length, source: 'synonym', matchedTokens: st };
            }
        }
    });

    return shortest; // null if none
}

function collectAllMatches(itemList, tokens) {
    return itemList.map(item => {
        const shortest = shortestExactMatchForItem(item, tokens);
        return shortest ? { item: item, matchLength: shortest.matchLength, source: shortest.source, matchedTokens: shortest.matchedTokens } : null;
    }).filter(m => m !== null);
}

function pickUniqueShortestMatch(matches) {
    if (!matches || matches.length === 0) return null;
    const shortestLength = Math.min(...matches.map(m => m.matchLength));
    const shortestMatches = matches.filter(m => m.matchLength === shortestLength);
    if (shortestMatches.length === 1) return shortestMatches[0];
    return null; // ambiguous
}

function getItemByLabelOrSynonym(itemList, tokens) {
    // Use helper pipeline: collect matches, pick unique shortest
    const matches = collectAllMatches(itemList, tokens);
    if (matches.length === 0) {
        logger.debug("get item by label: no matches found");
        return null;
    }

    const best = pickUniqueShortestMatch(matches);
    if (best) {
        logger.debug("get item by label: success - single shortest match");
        return { matchedItem: best.item, remainingTokens: tokens.slice(best.matchLength) };
    }

    logger.debug("get item by label: fail - multiple shortest matches");
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
    if (typeof item.getMetadata !== 'function') {
        // gracefully handle missing getMetadata method, e.g. in unit tests, but log a warning
        logger.warn("Item " + item.name + " does not implement getMetadata method - skipping synonyms");
        return [];
    }
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
    itemProperties,
    // exported helpers for unit tests
    tokenizeNormalized,
    getSynonymTokens,
    shortestExactMatchForItem,
    collectAllMatches,
    pickUniqueShortestMatch
}