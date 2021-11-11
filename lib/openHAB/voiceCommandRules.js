// HOW TO load this file from a script/rule created in Main UI:
// var OPENHAB_CONF = Java.type('java.lang.System').getenv('OPENHAB_CONF');
// load(OPENHAB_CONF + '/automation/lib/javascript/personal/voiceCommandRules.js');

'use strict';
var isOhEnv = typeof module === "undefined" && typeof require === "undefined";

var ruleBasedInterpreter;
if (isOhEnv) {
    var OPENHAB_CONF = Java.type('java.lang.System').getenv('OPENHAB_CONF');
    load(OPENHAB_CONF + '/automation/lib/javascript/personal/ruleBasedInterpreter.js');
} else {
    var rbi = require("./ruleBasedInterpreter");
    ruleBasedInterpreter = rbi.ruleBasedInterpreter;
}

function voiceCommandRulesMain(context) {
    'use strict';

    var alt = ruleBasedInterpreter.alt;
    var seq = ruleBasedInterpreter.seq;
    var cmd = ruleBasedInterpreter.cmd;
    var opt = ruleBasedInterpreter.opt;
    var itemLabel = ruleBasedInterpreter.itemLabel;
    var addRule = ruleBasedInterpreter.addRule;

    // ** ENGLISH **************************

    var onOff = alt([cmd("on", ON), cmd("off", OFF)]);
    var turn = alt(["turn", "switch"]);
    var put = alt(["put", "bring"]);
    var the = opt("the");
    var upDown = alt([cmd("up", UP), cmd("down", DOWN)]);

    // ON OFF type
    addRule(seq([turn, the, itemLabel, onOff]));
    addRule(seq([turn, onOff, the, itemLabel]));

    // UP DOWN type
    addRule(seq([put, the, itemLabel, upDown]));
    addRule(seq([put, upDown, the, itemLabel]));

    // *************************************

    // ** GERMAN ***************************
    var denDieDas = opt(alt(["den", "die", "das"]));
    var einAnAus = alt([cmd("ein", ON), cmd("an", ON), cmd("aus", OFF)]);
    var schalte = alt(["schalte", "mache", "schalt", "mach"]);
    var fahre = alt(["fahre", "fahr", "mache", "mach"]);
    var hochRunter = alt([cmd("hoch", UP), cmd("runter", DOWN)]);

    // ON OFF type
    addRule(seq([schalte, denDieDas, itemLabel(), einAnAus]));
    
    // UP DOWN type
    addRule(seq([fahre, denDieDas, itemLabel(), hochRunter]));
    
    // *************************************

    // ** CUSTOM RULES *********************
    // Add your rules here
    // *************************************
}

if (isOhEnv) {
    voiceCommandRulesMain(this); 
} else {
    var context = {};
    voiceCommandRulesMain(context);
    module.exports = context;
}