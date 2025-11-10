const { RuleBasedInterpreter, alt, seq, opt, cmd, item } = require("./ruleBasedInterpreter");

// ==== YAML RULE TEMPLATE START ====
const { ON, OFF, UP, DOWN } = require("@runtime");

let rbi = new RuleBasedInterpreter();

function interpretUtterance(utterance) {
    return JSON.stringify(rbi.interpretUtterance(utterance));
}

// ** ENGLISH **************************

let onOff = alt(cmd("on", ON), cmd("off", OFF));
let turn = alt("turn", "switch");
let put = alt("put", "bring", "pull");
let the = opt("the");
let inOfThe = seq(alt("in", "of"), the);
let allThe = alt(seq("all", the), the);
let upDown = alt(cmd("up", UP), cmd("down", DOWN));
let lowerRaise = alt(cmd("lower", DOWN),cmd("raise", UP));

// turn lights on off in location
let lights = alt("light", "lights");
rbi.addRule(seq(
    turn,
    opt(onOff),
    allThe,
    item({ type: "Switch", tag: "Light", matchMultiple: true }, 
        { expr: seq(lights, opt(onOff), inOfThe, item({ type: "Group", include: false })), groupContext: "last" }),
    opt(onOff))
);
rbi.addRule(seq(
    turn,
    opt(onOff),
    allThe,
    item({ type: "Switch", tag: "Light", matchMultiple: true }, 
        { expr: seq(item({ type: "Group", include: false }), lights), groupContext: "last" }),
    opt(onOff))
);

// rollershutters up/down in location
let rollershutters = alt("rollershutter", "rollershutters", seq("roller", alt("shutter", "blind")), seq("roller", alt("shutters", "blinds")), "shutter", "shutters", "blind", "blinds");
rbi.addRule(
    seq(
        put,
        opt(upDown),
        allThe,
        item({ type: "Rollershutter", matchMultiple: true }, 
            { expr: seq(rollershutters, opt(upDown), inOfThe, item({ type: "Group", include: false })), groupContext: "last" }),
        opt(upDown),
    )
);
rbi.addRule(
    seq(
        lowerRaise,
        allThe,
        item({ type: "Rollershutter", matchMultiple: true }, 
            { expr: seq(rollershutters, inOfThe, item({ type: "Group", include: false })), groupContext: "last" })
    )
);
rbi.addRule(
    seq(
        put,
        opt(upDown),
        allThe,
        item({ type: "Rollershutter", matchMultiple: true }, 
            { expr: seq(item({ type: "Group", include: false }), rollershutters), groupContext: "last" }),
        opt(upDown),
    )
);
rbi.addRule(
    seq(
        lowerRaise,
        allThe,
        item({ type: "Rollershutter", matchMultiple: true }, 
            { expr: seq(item({ type: "Group", include: false }), rollershutters), groupContext: "last" })
    )
);

// ON OFF type
rbi.addRule(seq(turn, opt(onOff), the, item(), opt(onOff)));

// UP DOWN type
rbi.addRule(seq(put, opt(upDown), the, item(), opt(upDown)));
rbi.addRule(seq(lowerRaise, the, item()));

// *************************************

// ** GERMAN ***************************
var denDieDas = opt(alt("den", "die", "das"));
var einAnAus = alt(cmd(alt("ein", "an"), ON), cmd("aus", OFF));
var schalte = alt("schalte", "mache", "schalt", "mach");
var fahre = alt("fahre", "fahr", "mache", "mach");
var hochRunter = alt(cmd(alt("hoch", "auf"), UP), cmd(alt("runter", "herunter", "zu"), DOWN));
let imIn = alt("im", seq("in", opt(alt("der", "dem"))));

// ON OFF type
rbi.addRule(seq(schalte, denDieDas, item(), einAnAus));

// UP DOWN type
rbi.addRule(seq(fahre, denDieDas, item(), hochRunter));


let alleDie = alt("alle", denDieDas);

// turn lights on off in location
let lichter = alt("licht", "lichter", "lampen");
rbi.addRule(seq(
    schalte,
    alleDie,
    item({ type: "Switch", tag: "Light", matchMultiple: true }, 
        { expr: seq(lichter, opt(einAnAus), imIn, item({ type: "Group", include: false })), groupContext: "last" }),
    opt(einAnAus))
);

// rollershutters up/down in location
let rollos = alt("rollo", "rollos", "rolladen", "rolläden");
rbi.addRule(
    seq(
        fahre,
        denDieDas,
        item({ type: "Rollershutter", matchMultiple: true }, 
            { expr: seq(rollos, imIn, item({ type: "Group", include: false })), groupContext: "last" }),
        hochRunter
    )
);

// *************************************

// ** CUSTOM RULES *********************
// Add your rules here
// *************************************


// ==== YAML RULE TEMPLATE END ====

// ***
// EXPORTS
// ***
module.exports = {
    interpretUtterance
};