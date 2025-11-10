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
const { RuleBasedInterpreter, alt, seq, opt } = require("../lib/openHAB/ruleBasedInterpreter");

let rbi = new RuleBasedInterpreter();

beforeEach(() => {
    rbi.clearRules();
    openhab.items.getItems.mockReturnValue([]);
});

describe("optional expression", () => {
    it("matches same or none string", () => {
        let testExpression = seq(opt("bar"), "foo");
        let testFunction = jest.fn();
        rbi.addRule(testExpression, testFunction);
        rbi.interpretUtterance("foo");
        expect(testFunction.mock.calls.length).toBe(1);
        rbi.interpretUtterance("bar foo");
        expect(testFunction.mock.calls.length).toBe(2);
    });

    it("does not match other string", () => {
        let testExpression = seq(opt("bar"), "foo");
        let testFunction = jest.fn();
        rbi.addRule(testExpression, testFunction);
        rbi.interpretUtterance("other foo");
        expect(testFunction.mock.calls.length).toBe(0);
        rbi.interpretUtterance("bar bar foo");
        expect(testFunction.mock.calls.length).toBe(0);
    });

    it("is successful at the end when no tokens are left", () => {
        let testExpression = seq("first", alt("second", opt("foo")), opt("bar"));
        let testFunction = jest.fn();
        rbi.addRule(testExpression, testFunction);
        rbi.interpretUtterance("first second");
        expect(testFunction.mock.calls.length).toBe(1);
    });
});