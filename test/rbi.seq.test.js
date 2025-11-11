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
const { RuleBasedInterpreter, seq, cmd, item } = require("../lib/openHAB/ruleBasedInterpreter");

let rbi = new RuleBasedInterpreter();

beforeEach(() => {
    rbi.clearRules();
    openhab.items.getItems.mockReturnValue([]);
});

describe("single sequence expression", () => {
    it("matches correct sequence", () => {
        let testExpression = seq("bar", "foo", "foobar");
        let testFunction = jest.fn();
        rbi.addRule(testExpression, testFunction);
        rbi.interpretUtterance("bar foo foobar");
        expect(testFunction.mock.calls.length).toBe(1);
    });

    it("does not match wrong sequence", () => {
        let testExpression = seq("bar", "foo", "foobar");
        let testFunction = jest.fn();
        rbi.addRule(testExpression, testFunction);
        rbi.interpretUtterance("foo foobar");
        expect(testFunction.mock.calls.length).toBe(0);
    });

    it("matches normalized unicode characters and apostrophes", () => {
        let testExpression = seq("tÈS$Tö'ó");
        let testFunction = jest.fn();
        rbi.addRule(testExpression, testFunction);
        rbi.interpretUtterance("2TèstÖ'Ó");
        expect(testFunction.mock.calls.length).toBe(1);
    });

    it("matches first token and ignores further", () => {
        let testExpression = seq("foo bar");
        let testFunction = jest.fn();
        rbi.addRule(testExpression, testFunction);
        rbi.interpretUtterance("foo abc");
        expect(testFunction.mock.calls.length).toBe(1);
    });

    it("merges executeParameter from sequential expressions", () => {
        const itemA = {name: "itemA", label: "itemA", sendCommand: jest.fn()};
        const itemB = {name: "itemB", label: "itemB", sendCommand: jest.fn()};

        // Mock items to be returned by different expressions
        when(openhab.items.getItems).mockReturnValue([itemA, itemB]);

        const testExpression = seq(item(), item(), cmd("foo", 123));
        rbi.addRule(testExpression);

        // Execute and verify both items received commands
        rbi.interpretUtterance("itemA itemB foo");
        expect(itemA.sendCommand).toHaveBeenCalledWith(123);
        expect(itemB.sendCommand).toHaveBeenCalledWith(123);
    });

    it("preserves duplicates when merging executeParameter.items", () => {
        const itemA = {name: "itemA", label: "itemA", sendCommand: jest.fn()};
        when(openhab.items.getItems).mockReturnValue([itemA]);

        const testExpression = seq(item(), item(), cmd("foo", 123));
        rbi.addRule(testExpression);

        // Item should receive command twice since it's included twice
        rbi.interpretUtterance("itemA itemA foo");
        expect(itemA.sendCommand).toHaveBeenCalledTimes(2);
    });
});