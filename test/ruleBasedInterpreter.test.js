global.ON = true;
global.OFF = false;
global.UP = 0;
global.DOWN = 100;
global.Java = {
    from: jest.fn(x => x),
    type: jest.fn(() => ({
        getLogger: jest.fn(() => ({
            debug: jest.fn()
            // debug: jest.fn(x => console.log(x))
        }))
    }))
};

const rbi = require("../lib/ruleBasedInterpreter");

const alt = rbi.ruleBasedInterpreter.alt;
const seq = rbi.ruleBasedInterpreter.seq;
const cmd = rbi.ruleBasedInterpreter.cmd;
const opt = rbi.ruleBasedInterpreter.opt;
const itemLabel = rbi.ruleBasedInterpreter.itemLabel;
const addRule = rbi.ruleBasedInterpreter.addRule;
const clearRules = rbi.ruleBasedInterpreter.clearRules;

beforeAll(() => {
    global.events = {
        sendCommand: jest.fn()
    };

    global.itemRegistry = {
        getItems: jest.fn().mockReturnValue([{getLabel: () => "Rollo Esszimmer"}])
    }
});

beforeEach(() => {
    clearRules();
});

describe("interpretUtterance", () => {
    describe("single alternative expression", () => {
        it("matches same string", () => {
            var testExpression = alt(["bar", "foo", "foobar"]);
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("foo");
            expect(testFunction.mock.calls.length).toBe(1);
            rbi.ruleBasedInterpreter.interpretUtterance("bar");
            expect(testFunction.mock.calls.length).toBe(2);
            rbi.ruleBasedInterpreter.interpretUtterance("foobar");
            expect(testFunction.mock.calls.length).toBe(3);
        });

        it("does not match other string", () => {
            var testExpression = alt(["bar", "foo", "foobar"]);
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("fob");
            expect(testFunction.mock.calls.length).toBe(0);
        });
    });

    describe("single sequence expression", () => {
        it("matches correct sequence", () => {
            var testExpression = seq(["bar", "foo", "foobar"]);
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("bar foo foobar");
            expect(testFunction.mock.calls.length).toBe(1);
        });

        it("does not match wrong sequence", () => {
            var testExpression = seq(["bar", "foo", "foobar"]);
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("foo foobar");
            expect(testFunction.mock.calls.length).toBe(0);
        });
    });

    describe("single string expression", () => {
        it("matches same string and executes rule function", () => {
            var testExpression = "foo";
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("foo");
            expect(testFunction.mock.calls.length).toBe(1);
        });

        it("does not match similar string", () => {
            var testExpression = "foo";
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("fo");
            expect(testFunction.mock.calls.length).toBe(0);
            rbi.ruleBasedInterpreter.interpretUtterance("fooo");
            expect(testFunction.mock.calls.length).toBe(0);
        });
        
        it("does not match other string", () => {
            var testExpression = "foo";
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("bar");
            expect(testFunction.mock.calls.length).toBe(0);
        });
        
        it("does not match empty string", () => {
            var testExpression = "foo";
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("");
            expect(testFunction.mock.calls.length).toBe(0);
        });
        
        it("does not match null", () => {
            var testExpression = "foo";
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance(null);
            expect(testFunction.mock.calls.length).toBe(0);
        });
        
        it("does not match undefined", () => {
            var testExpression = "foo";
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance(undefined);
            expect(testFunction.mock.calls.length).toBe(0);
        });
    });
});