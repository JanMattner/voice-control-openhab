const {when} = require("jest-when");
jest.mock("openhab");
const openhab = require("openhab");
openhab.items = {
    getItems: jest.fn().mockReturnValue([]),
    getItemsByTag: jest.fn().mockReturnValue([]),
    getItem: jest.fn().mockReturnValue(null)
};
openhab.log = jest.fn().mockReturnValue({
    /* Uncomment to get logs during test execution
    info: console.log,
    debug: console.debug,
    warn: console.warn
    //*/
    ///* Comment to get logs during test execution
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
    //*/
});
const { RuleBasedInterpreter, alt, seq, cmd, item } = require("../lib/openHAB/ruleBasedInterpreter");

let rbi = new RuleBasedInterpreter();

beforeEach(() => {
    rbi.clearRules();
    openhab.items.getItems.mockReturnValue([]);
});

describe("alternative expression", () => {
    it("matches same string", () => {
        let testExpression = alt("bar", "foo", "foobar");
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
        let testExpression = alt("bar", "foo", "foobar");
        let testFunction = jest.fn();
        rbi.addRule(testExpression, testFunction);
        rbi.interpretUtterance("fob");
        expect(testFunction.mock.calls.length).toBe(0);
    });

    it("merges executeParameter from alternative expressions (first match)", () => {
        const itemA = {name: "itemA", label: "itemA", sendCommand: jest.fn()};
        const itemB = {name: "itemB", label: "itemB", sendCommand: jest.fn()};

        when(openhab.items.getItems).mockReturnValue([itemA, itemB]);
        when(openhab.items.getItemsByTag).calledWith(...["tagA"]).mockReturnValue([itemA]);
        when(openhab.items.getItemsByTag).calledWith(...["tagB"]).mockReturnValue([itemB]);

        // First alternative fails, second matches and provides executeParameter
        const exprA = item({ tag: "tagA" }, { expr: seq("nonexistent") });
        const exprB = item({ tag: "tagB" }, { expr: seq("existing") });
        
        const testExpression = seq(alt(exprA, exprB), cmd("foo", 123));
        rbi.addRule(testExpression);

        rbi.interpretUtterance("existing foo");
        expect(itemA.sendCommand).not.toHaveBeenCalled();
        expect(itemB.sendCommand).toHaveBeenCalledWith(123);
    });
});