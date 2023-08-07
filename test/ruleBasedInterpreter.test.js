jest.mock("openhab");
const openhab = require("openhab");
openhab.items = {
    getItems: jest.fn().mockReturnValue([])
};
const { RuleBasedInterpreter, alt, seq, opt, cmd, itemLabel } = require("../lib/openHAB/ruleBasedInterpreter");

let rbi = new RuleBasedInterpreter();

beforeEach(() => {
    rbi.clearRules();
    openhab.items.getItems.mockReturnValue([]);
    global.console = {
        debug: jest.fn(),
        info: jest.fn()
    }
});

describe("interpretUtterance", () => {
    describe("single alternative expression", () => {
        it("matches same string", () => {
            let testExpression = alt(["bar", "foo", "foobar"]);
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("foo");
            expect(testFunction.mock.calls.length).toBe(1);
            rbi.interpretUtterance("bar");
            expect(testFunction.mock.calls.length).toBe(2);
            rbi.interpretUtterance("foobar");
            expect(testFunction.mock.calls.length).toBe(3);
        });

        it("does not match other string", () => {
            let testExpression = alt(["bar", "foo", "foobar"]);
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("fob");
            expect(testFunction.mock.calls.length).toBe(0);
        });
    });

    describe("command expression", () => {
        it("executes no function when no item expression is contained", () => {
            let testExpression = cmd("foo", 1);
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("foo");
            expect(testFunction.mock.calls.length).toBe(0);
        });

        it("sends command to found item", () => {
            let retItem = {label: "my item", sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([retItem])
            
            let cmdParameter = 123;
            let testExpression = seq([itemLabel(),cmd("foo", cmdParameter)]);
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("my item foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(retItem.sendCommand.mock.calls.length).toBe(1);
            expect(retItem.sendCommand.mock.calls[0].length).toBe(1);
            expect(retItem.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
        });
    });

    describe("item expression", () => {
        it("sends command to found item by label", () => {
            let item1 = {label: "item one", sendCommand: jest.fn()};
            let item2 = {label: "item two", sendCommand: jest.fn()};
            let item3 = {label: "third item", sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([item1, item2, item3]);
            
            let cmdParameter = 123;
            let testExpression = seq([itemLabel(),cmd("foo", cmdParameter)]);
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("item one foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item1.sendCommand.mock.calls.length).toBe(1);
            expect(item1.sendCommand.mock.calls[0].length).toBe(1);
            expect(item1.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

            rbi.interpretUtterance("item two foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item2.sendCommand.mock.calls.length).toBe(1);
            expect(item2.sendCommand.mock.calls[0].length).toBe(1);
            expect(item2.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

            rbi.interpretUtterance("third item foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item3.sendCommand.mock.calls.length).toBe(1);
            expect(item3.sendCommand.mock.calls[0].length).toBe(1);
            expect(item3.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
        });

        it("sends command to found item by synonym", () => {
            let firstName = "item one";
            let secondName = "item two";
            let thirdName = "third item";
            let getMetadataImplementation = (data) => (namespace) => {
                if (namespace != "synonyms") {
                    return null;
                }
                return {value: data};
            };

            let item1 = {label: firstName, sendCommand: jest.fn(),
                getMetadata: jest.fn(getMetadataImplementation("bar one, barbar"))};
            let item2 = {label: secondName, sendCommand: jest.fn(),
                getMetadata: jest.fn(getMetadataImplementation("second bar"))};
            let item3 = {label: thirdName, sendCommand: jest.fn(),
                getMetadata: jest.fn(getMetadataImplementation("bar three"))};
            openhab.items.getItems.mockReturnValue([item1, item2, item3]);

            let cmdParameter = 123;
            let testExpression = seq([itemLabel(),cmd("foo", cmdParameter)]);
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("bar one foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item1.sendCommand.mock.calls.length).toBe(1);
            expect(item1.sendCommand.mock.calls[0].length).toBe(1);
            expect(item1.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

            rbi.interpretUtterance("barbar foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item1.sendCommand.mock.calls.length).toBe(2);
            expect(item1.sendCommand.mock.calls[1].length).toBe(1);
            expect(item1.sendCommand.mock.calls[1][0]).toBe(cmdParameter);

            rbi.interpretUtterance("second bar foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item2.sendCommand.mock.calls.length).toBe(1);
            expect(item2.sendCommand.mock.calls[0].length).toBe(1);
            expect(item2.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

            rbi.interpretUtterance("bar three foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item3.sendCommand.mock.calls.length).toBe(1);
            expect(item3.sendCommand.mock.calls[0].length).toBe(1);
            expect(item3.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
        });
    });

    describe("optional expression", () => {
        it("matches same or none string", () => {
            let testExpression = seq([opt("bar"), "foo"]);
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("foo");
            expect(testFunction.mock.calls.length).toBe(1);
            rbi.interpretUtterance("bar foo");
            expect(testFunction.mock.calls.length).toBe(2);
        });

        it("does not match other string", () => {
            let testExpression = seq([opt("bar"), "foo"]);
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("other foo");
            expect(testFunction.mock.calls.length).toBe(0);
            rbi.interpretUtterance("bar bar foo");
            expect(testFunction.mock.calls.length).toBe(0);
        });
    });

    describe("single sequence expression", () => {
        it("matches correct sequence", () => {
            let testExpression = seq(["bar", "foo", "foobar"]);
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("bar foo foobar");
            expect(testFunction.mock.calls.length).toBe(1);
        });

        it("does not match wrong sequence", () => {
            let testExpression = seq(["bar", "foo", "foobar"]);
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("foo foobar");
            expect(testFunction.mock.calls.length).toBe(0);
        });
    });

    describe("single string expression", () => {
        it("matches same string and executes rule function", () => {
            let testExpression = "foo";
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("foo");
            expect(testFunction.mock.calls.length).toBe(1);
        });

        it("does not match similar string", () => {
            let testExpression = "foo";
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("fo");
            expect(testFunction.mock.calls.length).toBe(0);
            rbi.interpretUtterance("fooo");
            expect(testFunction.mock.calls.length).toBe(0);
        });
        
        it("does not match other string", () => {
            let testExpression = "foo";
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("bar");
            expect(testFunction.mock.calls.length).toBe(0);
        });
        
        it("does not match empty string", () => {
            let testExpression = "foo";
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("");
            expect(testFunction.mock.calls.length).toBe(0);
        });
        
        it("does not match null", () => {
            let testExpression = "foo";
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance(null);
            expect(testFunction.mock.calls.length).toBe(0);
        });
        
        it("does not match undefined", () => {
            let testExpression = "foo";
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance(undefined);
            expect(testFunction.mock.calls.length).toBe(0);
        });
    });
});