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
const { RuleBasedInterpreter, seq, cmd, itemLabel } = require("../lib/openHAB/ruleBasedInterpreter");

let rbi = new RuleBasedInterpreter();

beforeEach(() => {
    rbi.clearRules();
    openhab.items.getItems.mockReturnValue([]);
});

describe("command expression", () => {
    it("sends command to found item", () => {
        let retItem = {label: "my item", sendCommand: jest.fn()};
        openhab.items.getItems.mockReturnValue([retItem])
        
        let cmdParameter = 123;
        let testExpression = seq(itemLabel(),cmd("foo", cmdParameter));
        rbi.addRule(testExpression, null);
        rbi.interpretUtterance("my item foo");
        expect(retItem.sendCommand.mock.calls.length).toBe(1);
        expect(retItem.sendCommand.mock.calls[0].length).toBe(1);
        expect(retItem.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
    });
});
