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

// turn lights on off in location
rbi.addRule(seq([
    turn,
    alt([
        the,
        opt("all"),
        the
    ]),
    itemProperties(
        seq([
            alt(["light", "lights"]),
            alt(["in", the]),
            locationLabel()]),
        ["Switch", "Light"]),
    onOff]));
rbi.addRule(seq([
    turn,
    onOff,
    alt([
        the,
        opt("all"),
        the
    ]),
    itemProperties(
        seq([
            alt(["light", "lights"]),
            "in", the,
            locationLabel()]),
        ["Switch", "Light"]),
    ]));
rbi.addRule(seq([
    turn,
    alt([
        the,
        opt("all"),
        the
    ]),
    itemProperties(
        seq([
            alt(["light", "lights"]),
            onOff,
            "in", the,
            locationLabel()]),
        ["Switch", "Light"]),
    ]));

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

// turn lights on off in location
rbi.addRule(seq([
    schalte,
    alt([
        denDieDas,
        opt("alle")
    ]),    
    itemProperties(
        seq([
            alt(["licht", "lichter", "lampen"]),
            alt(["im", seq(["in", alt(["der", "dem"])])]),
            locationLabel()]),
        ["Switch", "Light"]),
    einAnAus]));

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