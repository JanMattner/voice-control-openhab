const { RuleBasedInterpreter, alt, seq, opt, cmd, itemLabel } = require("./ruleBasedInterpreter");
const { ON, OFF, UP, DOWN } = require("@runtime");

let rbi = new RuleBasedInterpreter();

function interpretUtterance(utterance) {
    rbi.interpretUtterance(utterance);
}

// ** ENGLISH **************************

let onOff = alt([cmd("on", ON), cmd("off", OFF)]);
let turn = alt(["turn", "switch"]);
let put = alt(["put", "bring"]);
let the = opt("the");
let upDown = alt([cmd("up", UP), cmd("down", DOWN)]);

// ON OFF type
rbi.addRule(seq([turn, the, itemLabel(), onOff]));
rbi.addRule(seq([turn, onOff, the, itemLabel]));

// UP DOWN type
rbi.addRule(seq([put, the, itemLabel, upDown]));
rbi.addRule(seq([put, upDown, the, itemLabel]));

// *************************************

// ** GERMAN ***************************
var denDieDas = opt(alt(["den", "die", "das"]));
var einAnAus = alt([cmd("ein", ON), cmd("an", ON), cmd("aus", OFF)]);
var schalte = alt(["schalte", "mache", "schalt", "mach"]);
var fahre = alt(["fahre", "fahr", "mache", "mach"]);
var hochRunter = alt([cmd("hoch", UP), cmd("runter", DOWN)]);

// ON OFF type
rbi.addRule(seq([schalte, denDieDas, itemLabel(), einAnAus]));

// UP DOWN type
rbi.addRule(seq([fahre, denDieDas, itemLabel(), hochRunter]));

// *************************************

// ** CUSTOM RULES *********************
// Add your rules here
// *************************************


// ***
// EXPORTS
// ***
module.exports = {
    interpretUtterance
};