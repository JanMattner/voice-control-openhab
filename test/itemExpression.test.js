const {when} = require("jest-when");
jest.mock("openhab");
const openhab = require("openhab");
openhab.items = {
    getItems: jest.fn().mockReturnValue([]),
    getItemsByTag: jest.fn().mockReturnValue([]),
    getItem: jest.fn().mockReturnValue(null)
};

// mocked logger - ensure we can inspect warn calls but also print to console for debugging
let mockWarnCalls = [];
const mockLogger = {
    info: (...args) => console.log("[INFO]", ...args),
    debug: (...args) => console.log("[DEBUG]", ...args),
    warn: (...args) => {
        console.log("[WARN]", ...args);
        mockWarnCalls.push(args);
    }
};
mockLogger.warn.mockClear = () => mockWarnCalls = [];
openhab.log = jest.fn().mockReturnValue(mockLogger);

const { RuleBasedInterpreter, seq, cmd, item } = require("../lib/openHAB/ruleBasedInterpreter");

let rbi = new RuleBasedInterpreter();

beforeEach(() => {
    rbi.clearRules();
    openhab.items.getItems.mockReturnValue([]);
    mockLogger.warn.mockClear();
});

describe("unified item() expression", () => {
    it("allows multiple matches when matchMultiple=true", () => {
        let itemOne = {name: "one", label: "one", sendCommand: jest.fn()};
        let itemTwo = {name: "two", label: "two", sendCommand: jest.fn()};
        when(openhab.items.getItemsByTag).calledWith(...["bar"]).mockReturnValue([itemOne, itemTwo]);

        let cmdParameter = 123;
        let testExpression = seq(item({ tag: "bar", matchMultiple: true }, { expr: "something" }), cmd("works", cmdParameter));
        rbi.addRule(testExpression, null);

        rbi.interpretUtterance("something works");
        expect(itemOne.sendCommand.mock.calls.length).toBe(1);
        expect(itemTwo.sendCommand.mock.calls.length).toBe(1);
    });

    it("tagMode 'any' unions tag results", () => {
        let itemA = {name: "a", label: "a", sendCommand: jest.fn()};
        let itemB = {name: "b", label: "b", sendCommand: jest.fn()};
        when(openhab.items.getItemsByTag).calledWith(...["a"]).mockReturnValue([itemA]);
        when(openhab.items.getItemsByTag).calledWith(...["b"]).mockReturnValue([itemB]);

        let cmdParameter = 999;
        let testExpression = seq(item({ tag: ["a","b"], tagMode: "any", matchMultiple: true }, { expr: "x" }), cmd("doit", cmdParameter));
        rbi.addRule(testExpression, null);

        rbi.interpretUtterance("x doit");
        expect(itemA.sendCommand.mock.calls.length).toBe(1);
        expect(itemB.sendCommand.mock.calls.length).toBe(1);
    });

    it("groupContext 'one' fails when multiple groups are provided by inner expr", () => {
        let g1 = {name: "g1", label: "a", type: "Group"};
        let g2 = {name: "g2", label: "b", type: "Group"};

        when(openhab.items.getItems).mockReturnValue([g1, g2]);

        let cmdParameter = 123;
        // attach an action so we can assert it is NOT called when matching fails
        const action = jest.fn();
        let testExpression = seq(item({ type: "Switch" }, { expr: seq(item({ type: "Group", include: false }), item({ type: "Group", include: false })), groupContext: "one" }), cmd("works", cmdParameter));
        rbi.addRule(testExpression, action);

        let result = rbi.interpretUtterance("a b works");
        // matching should fail when multiple groups are returned, so action must not be invoked
        expect(action).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        // Check that the warning message exists in one of the warn calls
        expect(mockWarnCalls.some(call => 
            call[0] === "eval item fail: groupContext 'one' but multiple groups matched (2); groups=[g1, g2]"
        )).toBe(true);
    });

    it("groupContext 'last' uses only the last group found", () => {
        // Create test items and groups
        const g1 = {name: "g1", type: "Group", label: "something", groupNames: []};
        const g2 = {name: "g2", type: "Group", label: "otherthing", groupNames: []};
        const item1 = {name: "item1", type: "Switch", label: "item1", groupNames: ["g1"], sendCommand: jest.fn()};
        const item2 = {name: "item2", type: "Switch", label: "item2", groupNames: ["g2"], sendCommand: jest.fn()};

        when(openhab.items.getItems).mockReturnValue([item1, item2, g1, g2]);
        when(openhab.items.getItem).calledWith("g1").mockReturnValue(g1);
        when(openhab.items.getItem).calledWith("g2").mockReturnValue(g2);

        const cmdParam = 123;
        const expr = seq(
            item({ type: "Switch", matchMultiple: true }, 
                { expr: seq(item({ type: "Group", include: false }), "or", item({ type: "Group", include: false })), groupContext: "last" }),
            cmd("works", cmdParam)
        );
        const action = jest.fn((items, param) => items.forEach(i => i.sendCommand(param)));
        rbi.addRule(expr, action);

        rbi.interpretUtterance("something or otherthing works");

        // Only items in the last matched group should receive the command
        expect(item2.sendCommand).toHaveBeenCalledWith(cmdParam);
        expect(item1.sendCommand).not.toHaveBeenCalled();
    });

    it("groupContext 'all' uses all groups found", () => {
        const g1 = {name: "g1", type: "Group", label: "a", groupNames: [], sendCommand: jest.fn()};
        const g2 = {name: "g2", type: "Group", label: "b", groupNames: [], sendCommand: jest.fn()};
        const item1 = {name: "item1", type: "Switch", label: "item1", groupNames: ["g1"], sendCommand: jest.fn()};
        const item2 = {name: "item2", type: "Switch", label: "item2", groupNames: ["g2"], sendCommand: jest.fn()};
        const item3 = {name: "item3", type: "Switch", label: "item3", groupNames: [], sendCommand: jest.fn()};

        when(openhab.items.getItems).mockReturnValue([item1, item2, item3, g1, g2]);
        when(openhab.items.getItem).calledWith("g1").mockReturnValue(g1);
        when(openhab.items.getItem).calledWith("g2").mockReturnValue(g2);

        const cmdParam = "ON";

        const expr = seq(
            item({ type: "Switch", matchMultiple: true }, 
                { expr: seq(item({ type: "Group" }), item({ type: "Group" })), groupContext: "all" }),
            cmd("on", cmdParam)
        );
        const action = jest.fn((items, param) => items.forEach(i => i.sendCommand(param)));
        rbi.addRule(expr, action);
        rbi.interpretUtterance("a b on");

        expect(item1.sendCommand).toHaveBeenCalledWith(cmdParam);
        expect(item2.sendCommand).toHaveBeenCalledWith(cmdParam);
        expect(item3.sendCommand).not.toHaveBeenCalled();
    });

    it("groupContext 'all' with no groups returns empty result", () => {
        const item1 = {name: "item1", type: "Switch", groupNames: [], sendCommand: jest.fn()};
        when(openhab.items.getItems).mockReturnValue([item1]);

        const cmdParameter = 123;
        const action = jest.fn((items, param) => items.forEach(i => i.sendCommand(param)));
        const testExpression = seq(item({ type: "Switch" }, { expr: item({ type: "Group" }), groupContext: "all" }), cmd("works", cmdParameter));
        rbi.addRule(testExpression, action);

        let result = rbi.interpretUtterance("x works");
        expect(item1.sendCommand).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
    });

    it("invalid parameter types are handled gracefully", () => {
        // construct with bad types to trigger validation checks
        const bad = item({ tag: 123, include: "yes", matchMultiple: "nope", tagMode: "unknown" });
        when(openhab.items.getItems).mockReturnValue([]);
        const res = bad.evaluate(["foo"]);
        expect(res).toBeDefined();
        expect(typeof res).toBe('object');
        expect(res).toHaveProperty('success');
        expect(res).toHaveProperty('remainingTokens');
    });
});
