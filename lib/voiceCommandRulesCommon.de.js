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
    var rbi = require("../lib/ruleBasedInterpreter");
    ruleBasedInterpreter = rbi.ruleBasedInterpreter;
}

function main(context) {
    'use strict';

    var alt = ruleBasedInterpreter.alt;
    var seq = ruleBasedInterpreter.seq;
    var cmd = ruleBasedInterpreter.cmd;
    var opt = ruleBasedInterpreter.opt;
    var itemLabel = ruleBasedInterpreter.itemLabel;
    var addRule = ruleBasedInterpreter.addRule;
    
    var denDieDas = alt(["den", "die", "das"]);
    var einAnAus = alt([cmd("ein", ON), cmd("an", ON), cmd("aus", OFF)]);
    var schalte = alt(["schalte", "mache", "schalt", "mach"]);
    var fahre = alt(["fahre", "fahr", "mache", "mach"]);
    var hochRunter = alt([cmd("hoch", UP), cmd("runter", DOWN)]);

    // ON OFF type
    addRule(seq([schalte, opt(denDieDas), itemLabel(), einAnAus]));
    
    // UP DOWN type
    addRule(seq([fahre, opt(denDieDas), itemLabel(), hochRunter]));
}

if (isOhEnv) {
    main(this); 
} else {
    var context = {};
    main(context);
    module.exports = context;
}