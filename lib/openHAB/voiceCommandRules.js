const { RuleBasedInterpreter, alt, seq, opt, cmd, itemProperties, itemLabel } = require("./ruleBasedInterpreter");
const { ON, OFF, UP, DOWN } = require("@runtime");

let rbi = new RuleBasedInterpreter();

function interpretUtterance(utterance) {
    rbi.interpretUtterance(utterance);
}

// ** ENGLISH **************************

let onOff = alt(cmd("on", ON), cmd("off", OFF));
let turn = alt("turn", "switch");
let put = alt("put", "bring");
let the = opt("the");
let inOfThe = seq(alt("in", "of"), the);
let allThe = alt(seq("all", the), the);
let upDown = alt(cmd("up", UP), cmd("down", DOWN));

// ON OFF type
rbi.addRule(seq(turn, opt(onOff), the, itemLabel(), opt(onOff)));

// UP DOWN type
rbi.addRule(seq(put, opt(upDown), the, itemLabel(), opt(upDown)));

// turn lights on off in location
let lights = alt("light", "lights");
rbi.addRule(seq(
    turn,
    opt(onOff),
    allThe,
    itemProperties(
        seq(
            lights,
            opt(onOff),
            inOfThe,
            itemLabel(false, true)),
        ["Light"], true, "SwitchItem"),
    opt(onOff))
);
rbi.addRule(seq(
    turn,
    opt(onOff),
    allThe,
    itemProperties(
        seq(
            itemLabel(false, true),
            lights),
        ["Light"], true, "SwitchItem"),
    opt(onOff))
);

// rollershutters up/down in location
let rollershutters = alt("rollershutter", "rollershutters", seq("roller", alt("shutter", "blind")), seq("roller", alt("shutters", "blinds")), "shutter", "shutters", "blind", "blinds");
rbi.addRule(
    seq(
        put,
        opt(upDown),
        allThe,
        itemProperties(
            seq(
                rollershutters,
                opt(upDown),
                inOfThe,
                itemLabel(false, true)
            ),
            null, true, "RollershutterItem"
        ),
        opt(upDown),
    )
);
rbi.addRule(
    seq(
        put,
        opt(upDown),
        allThe,
        itemProperties(
            seq(
                itemLabel(false, true),
                rollershutters
            ),
            null, true, "RollershutterItem"
        ),
        opt(upDown),
    )
);
// *************************************

// ** GERMAN ***************************
var denDieDas = opt(alt("den", "die", "das"));
var einAnAus = alt(cmd(alt("ein", "an"), ON), cmd("aus", OFF));
var schalte = alt("schalte", "mache", "schalt", "mach");
var fahre = alt("fahre", "fahr", "mache", "mach");
var hochRunter = alt(cmd(alt("hoch", "auf"), UP), cmd(alt("runter", "herunter", "zu"), DOWN));
let imIn = alt("im", seq("in", opt(alt("der", "dem"))));

// ON OFF type
rbi.addRule(seq(schalte, denDieDas, itemLabel(), einAnAus));

// UP DOWN type
rbi.addRule(seq(fahre, denDieDas, itemLabel(), hochRunter));


let alleDie = alt("alle", denDieDas);

// turn lights on off in location
let lichter = alt("licht", "lichter", "lampen");
rbi.addRule(seq(
    schalte,
    alleDie,    
    itemProperties(
        seq(
            lichter,
            opt(einAnAus),
            imIn,
            itemLabel(false, true)),
        ["Light"], true, "SwitchItem"),
    opt(einAnAus))
);

// rollershutters up/down in location
let rollos = alt("rollo", "rollos", "rolladen", "rolläden");
rbi.addRule(
    seq(
        fahre,
        denDieDas,
        itemProperties(
            seq(
                rollos,
                imIn,
                itemLabel(false, true)
            ),
            null, true, "RollershutterItem"
        ),
        hochRunter
    )
);

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