var rbi = require("./openHAB/ruleBasedInterpreter");
var ruleBasedInterpreter = rbi.ruleBasedInterpreter;
var alt = ruleBasedInterpreter.alt;
var seq = ruleBasedInterpreter.seq;
var cmd = ruleBasedInterpreter.cmd;
var opt = ruleBasedInterpreter.opt;
var itemLabel = ruleBasedInterpreter.itemLabel;
var addRule = ruleBasedInterpreter.addRule;

const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
});

addRule(seq([alt(["what's", seq(["what", "is"])]), "the", "time"]), () => {console.log("It is too late!")});
addRule("foo", () => {console.log("bar")});

function askForInput() {
    readline.question("Test your voice control!\n> ", utterance => {
        ruleBasedInterpreter.interpretUtterance(utterance);
        askForInput();
        });  
}

askForInput();
