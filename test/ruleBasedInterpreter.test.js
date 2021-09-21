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

const rbi = require("../lib/openHAB/ruleBasedInterpreter");
jest.mock("../lib/openHAB/utilities");
const utilities = require("../lib/openHAB/utilities").utilities;

const alt = rbi.ruleBasedInterpreter.alt;
const seq = rbi.ruleBasedInterpreter.seq;
const cmd = rbi.ruleBasedInterpreter.cmd;
const opt = rbi.ruleBasedInterpreter.opt;
const itemLabel = rbi.ruleBasedInterpreter.itemLabel;
const addRule = rbi.ruleBasedInterpreter.addRule;
const clearRules = rbi.ruleBasedInterpreter.clearRules;

beforeEach(() => {
    clearRules();
    global.itemRegistry = {
        getItems: jest.fn().mockReturnValue([])
    }

    global.events = {
        sendCommand: jest.fn()
    };
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

    describe("command expression", () => {
        it("executes no function when no item expression is contained", () => {
            var testExpression = cmd("foo", 1);
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(global.events.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found item", () => {
            global.itemRegistry = {
                getItems: jest.fn().mockReturnValue([{getLabel: () => "my item"}])
            }
            var cmdParameter = 123;
            var testExpression = seq([itemLabel(),cmd("foo", cmdParameter)]);
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("my item foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(global.events.sendCommand.mock.calls.length).toBe(1);
            expect(global.events.sendCommand.mock.calls[0].length).toBe(2);
            expect(global.events.sendCommand.mock.calls[0][1]).toBe(cmdParameter);
        });
    });

    describe("item expression", () => {
        it("sends command to found item by label", () => {
            global.itemRegistry = {
                getItems: jest.fn().mockReturnValue([
                    {getLabel: () => "item one"},
                    {getLabel: () => "item two"},
                    {getLabel: () => "third item"}])
            }
            var cmdParameter = 123;
            var testExpression = seq([itemLabel(),cmd("foo", cmdParameter)]);
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            
            rbi.ruleBasedInterpreter.interpretUtterance("item one foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(global.events.sendCommand.mock.calls.length).toBe(1);
            expect(global.events.sendCommand.mock.calls[0].length).toBe(2);
            expect(global.events.sendCommand.mock.calls[0][1]).toBe(cmdParameter);

            rbi.ruleBasedInterpreter.interpretUtterance("item two foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(global.events.sendCommand.mock.calls.length).toBe(2);
            expect(global.events.sendCommand.mock.calls[1].length).toBe(2);
            expect(global.events.sendCommand.mock.calls[1][1]).toBe(cmdParameter);

            rbi.ruleBasedInterpreter.interpretUtterance("third item foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(global.events.sendCommand.mock.calls.length).toBe(3);
            expect(global.events.sendCommand.mock.calls[2].length).toBe(2);
            expect(global.events.sendCommand.mock.calls[2][1]).toBe(cmdParameter);
        });

        it("sends command to found item by synonym", () => {
            var firstName = "item one";
            var secondName = "item two";
            var thirdName = "third item";
            global.itemRegistry = {
                getItems: jest.fn().mockReturnValue([
                    {getLabel: () => firstName, getName: () => firstName},
                    {getLabel: () => secondName, getName: () => secondName},
                    {getLabel: () => thirdName, getName: () => thirdName}])
            }

            utilities.getMetadata.mockImplementation((itemName, namespace) => {
                if (namespace != "synonyms") {
                    return null;
                }

                var value = null;
                switch (itemName) {
                    case firstName:
                        value = "bar one, barbar";
                        break;
                    case secondName:
                        value = "second bar";
                        break;
                    case thirdName:
                        value = "bar three";
                        break;
                    default:
                        break;
                }

                return {value: value};
            });

            var cmdParameter = 123;
            var testExpression = seq([itemLabel(),cmd("foo", cmdParameter)]);
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            
            rbi.ruleBasedInterpreter.interpretUtterance("bar one foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(global.events.sendCommand.mock.calls.length).toBe(1);
            expect(global.events.sendCommand.mock.calls[0].length).toBe(2);
            expect(global.events.sendCommand.mock.calls[0][1]).toBe(cmdParameter);

            rbi.ruleBasedInterpreter.interpretUtterance("barbar foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(global.events.sendCommand.mock.calls.length).toBe(2);
            expect(global.events.sendCommand.mock.calls[1].length).toBe(2);
            expect(global.events.sendCommand.mock.calls[1][1]).toBe(cmdParameter);

            rbi.ruleBasedInterpreter.interpretUtterance("second bar foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(global.events.sendCommand.mock.calls.length).toBe(3);
            expect(global.events.sendCommand.mock.calls[2].length).toBe(2);
            expect(global.events.sendCommand.mock.calls[2][1]).toBe(cmdParameter);

            rbi.ruleBasedInterpreter.interpretUtterance("bar three foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(global.events.sendCommand.mock.calls.length).toBe(4);
            expect(global.events.sendCommand.mock.calls[3].length).toBe(2);
            expect(global.events.sendCommand.mock.calls[3][1]).toBe(cmdParameter);
        });
    });

    describe("optional expression", () => {
        it("matches same or none string", () => {
            var testExpression = seq([opt("bar"), "foo"]);
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("foo");
            expect(testFunction.mock.calls.length).toBe(1);
            rbi.ruleBasedInterpreter.interpretUtterance("bar foo");
            expect(testFunction.mock.calls.length).toBe(2);
        });

        it("does not match other string", () => {
            var testExpression = seq([opt("bar"), "foo"]);
            var testFunction = jest.fn();
            addRule(testExpression, testFunction);
            rbi.ruleBasedInterpreter.interpretUtterance("other foo");
            expect(testFunction.mock.calls.length).toBe(0);
            rbi.ruleBasedInterpreter.interpretUtterance("bar bar foo");
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