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
const { RuleBasedInterpreter, seq, opt, cmd, itemLabel } = require("../lib/openHAB/ruleBasedInterpreter");

let rbi = new RuleBasedInterpreter();

beforeEach(() => {
    rbi.clearRules();
    openhab.items.getItems.mockReturnValue([]);
});

describe("itemLabel expression", () => {
    it("sends command to found item by label", () => {
        let itemOne = {label: "item one", sendCommand: jest.fn()};
        let itemTwo = {label: "item two", sendCommand: jest.fn()};
        let itemThree = {label: "third item", sendCommand: jest.fn()};
        openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree]);
        
        let cmdParameter = 123;
        let testExpression = seq(itemLabel(),cmd("foo", cmdParameter));
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("item one foo");
        expect(itemOne.sendCommand.mock.calls.length).toBe(1);
        expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
        expect(itemOne.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

        rbi.interpretUtterance("item two foo");
        expect(itemTwo.sendCommand.mock.calls.length).toBe(1);
        expect(itemTwo.sendCommand.mock.calls[0].length).toBe(1);
        expect(itemTwo.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

        rbi.interpretUtterance("third item foo");
        expect(itemThree.sendCommand.mock.calls.length).toBe(1);
        expect(itemThree.sendCommand.mock.calls[0].length).toBe(1);
        expect(itemThree.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
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

        let itemOne = {label: firstName, sendCommand: jest.fn(),
            getMetadata: jest.fn(getMetadataImplementation("bar one, barbar"))};
        let itemTwo = {label: secondName, sendCommand: jest.fn(),
            getMetadata: jest.fn(getMetadataImplementation("second bar"))};
        let itemThree = {label: thirdName, sendCommand: jest.fn(),
            getMetadata: jest.fn(getMetadataImplementation("bar three"))};
        openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree]);

        let cmdParameter = 123;
        let testExpression = seq(itemLabel(),cmd("foo", cmdParameter));
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("bar one foo");
        expect(itemOne.sendCommand.mock.calls.length).toBe(1);
        expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
        expect(itemOne.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

        rbi.interpretUtterance("barbar foo");
        expect(itemOne.sendCommand.mock.calls.length).toBe(2);
        expect(itemOne.sendCommand.mock.calls[1].length).toBe(1);
        expect(itemOne.sendCommand.mock.calls[1][0]).toBe(cmdParameter);

        rbi.interpretUtterance("second bar foo");
        expect(itemTwo.sendCommand.mock.calls.length).toBe(1);
        expect(itemTwo.sendCommand.mock.calls[0].length).toBe(1);
        expect(itemTwo.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

        rbi.interpretUtterance("bar three foo");
        expect(itemThree.sendCommand.mock.calls.length).toBe(1);
        expect(itemThree.sendCommand.mock.calls[0].length).toBe(1);
        expect(itemThree.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
    });

    it("prefers the shortest exact matching label when both short and long labels match the utterance", () => {
        let shortItem = {label: "TV", sendCommand: jest.fn(), getMetadata: jest.fn()};
        let longItem = {label: "TV Room", sendCommand: jest.fn(), getMetadata: jest.fn()};
        openhab.items.getItems.mockReturnValue([shortItem, longItem]);

        let cmdParameter = 123;
        let testExpression = seq(itemLabel(), opt("Room"), cmd("foo", cmdParameter));
        rbi.addRule(testExpression, null);

        // Both items match the utterance "TV Room foo" (short label "TV" and long label "TV Room").
        // Shortest exact match ("TV") should be preferred.
        rbi.interpretUtterance("TV Room foo");
        expect(shortItem.sendCommand.mock.calls.length).toBe(1);
        expect(longItem.sendCommand.mock.calls.length).toBe(0);
    });

    it("returns no match when multiple items have identical shortest exact labels", () => {
        let item1 = {label: "TV", sendCommand: jest.fn(), getMetadata: jest.fn()};
        let item2 = {label: "TV", sendCommand: jest.fn(), getMetadata: jest.fn()};
        openhab.items.getItems.mockReturnValue([item1, item2]);

        let cmdParameter = 123;
        let testExpression = seq(itemLabel(), cmd("foo", cmdParameter));
        rbi.addRule(testExpression, null);

        // Both items have the exact same shortest label -> ambiguous -> no command sent
        rbi.interpretUtterance("TV foo");
        expect(item1.sendCommand.mock.calls.length).toBe(0);
        expect(item2.sendCommand.mock.calls.length).toBe(0);
    });

    it("chooses the item with the shortest exact synonym when labels are longer", () => {
        let getMetadataImplementation = (data) => (namespace) => {
            if (namespace != "synonyms") {
                return null;
            }
            return {value: data};
        };

        let itemShortSyn = {label: "Living Room TV", sendCommand: jest.fn(), getMetadata: jest.fn(getMetadataImplementation("TV"))};
        let itemOther = {label: "TV Room", sendCommand: jest.fn(), getMetadata: jest.fn(getMetadataImplementation("TV Room"))};
        openhab.items.getItems.mockReturnValue([itemShortSyn, itemOther]);

        let cmdParameter = 123;
        let testExpression = seq(itemLabel(), opt("Room"), cmd("foo", cmdParameter));
        rbi.addRule(testExpression, null);

        // Utterance "TV Room foo" should match both (synonym "TV" and synonym "TV Room"),
        // but the shortest exact synonym ("TV") wins -> itemShortSyn should be called.
        rbi.interpretUtterance("TV Room foo");
        expect(itemShortSyn.sendCommand.mock.calls.length).toBe(1);
        expect(itemOther.sendCommand.mock.calls.length).toBe(0);
    });

    it("is ambiguous when a label and another item's synonym are equally short exact matches", () => {
        // item1 has label "TV" (short), item2 has synonym "TV" (short via synonym)
        let item1 = {label: "TV", sendCommand: jest.fn(), getMetadata: jest.fn()};
        let getMetadataImplementation = (data) => (namespace) => {
            if (namespace != "synonyms") {
                return null;
            }
            return {value: data};
        };
        let item2 = {label: "Television", sendCommand: jest.fn(), getMetadata: jest.fn(getMetadataImplementation("TV"))};
        openhab.items.getItems.mockReturnValue([item1, item2]);

        let cmdParameter = 123;
        let testExpression = seq(itemLabel(), cmd("foo", cmdParameter));
        rbi.addRule(testExpression, null);

        // Both provide a shortest exact match of length 1 -> ambiguous -> no command sent
        rbi.interpretUtterance("TV foo");
        expect(item1.sendCommand.mock.calls.length).toBe(0);
        expect(item2.sendCommand.mock.calls.length).toBe(0);
    });

    it("handles items missing getMetadata method and still finds shortest match", () => {
        // item1 has no getMetadata; item2 has a synonym "TV Set" -> item1 should be selected for "TV"
        let item1 = {label: "TV", sendCommand: jest.fn()}; // No getMetadata
        let getMetadataImplementation = (data) => (namespace) => {
            if (namespace != "synonyms") {
                return null;
            }
            return {value: data};
        };
        let item2 = {label: "Television", sendCommand: jest.fn(), getMetadata: jest.fn(getMetadataImplementation("TV Set"))};
        openhab.items.getItems.mockReturnValue([item1, item2]);

        let cmdParameter = 123;
        let testExpression = seq(itemLabel(), cmd("foo", cmdParameter));
        rbi.addRule(testExpression, null);

        rbi.interpretUtterance("TV foo");
        expect(item1.sendCommand.mock.calls.length).toBe(1);
        expect(item2.sendCommand.mock.calls.length).toBe(0);
    });

    describe("itemLabel isGroup behavior", () => {
        it("matches group when isGroup === true even if non-group shares label", () => {
            // Both items share the same label; when isGroup === true the group should be selected.
            let sharedLabel = "shared label";
            let groupItem = {label: sharedLabel, type: "Group", sendCommand: jest.fn(), getMetadata: jest.fn()};
            let normalItem = {label: sharedLabel, type: "Switch", sendCommand: jest.fn(), getMetadata: jest.fn()};
            openhab.items.getItems.mockReturnValue([groupItem, normalItem]);

            let cmdParameter = 321;
            let testExpression = seq(itemLabel(true, true), cmd("foo", cmdParameter));
            rbi.addRule(testExpression, null);

            rbi.interpretUtterance(`${sharedLabel} foo`);
            // Only the group should be considered due to isGroup === true
            expect(groupItem.sendCommand.mock.calls.length).toBe(1);
            expect(groupItem.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(normalItem.sendCommand.mock.calls.length).toBe(0);
        });

        it("is ambiguous (no match) when isGroup === false and duplicate labels exist", () => {
            // When isGroup === false both normal and group items are considered -> ambiguity -> no match
            let sharedLabel = "shared label";
            let groupItem = {label: sharedLabel, type: "Group", sendCommand: jest.fn(), getMetadata: jest.fn()};
            let normalItem = {label: sharedLabel, type: "Switch", sendCommand: jest.fn(), getMetadata: jest.fn()};
            openhab.items.getItems.mockReturnValue([groupItem, normalItem]);

            let cmdParameter = 456;
            let testExpression = seq(itemLabel(true, false), cmd("foo", cmdParameter));
            rbi.addRule(testExpression, null);

            rbi.interpretUtterance(`${sharedLabel} foo`);
            // No single exact match should be found -> no sendCommand calls
            expect(normalItem.sendCommand.mock.calls.length).toBe(0);
            expect(groupItem.sendCommand.mock.calls.length).toBe(0);
        });

        it("is ambiguous (no match) when isGroup is omitted (null) and duplicate labels exist", () => {
            let sharedLabel = "shared label";
            let groupItem = {label: sharedLabel, type: "Group", sendCommand: jest.fn(), getMetadata: jest.fn()};
            let normalItem = {label: sharedLabel, type: "Switch", sendCommand: jest.fn(), getMetadata: jest.fn()};
            openhab.items.getItems.mockReturnValue([groupItem, normalItem]);

            let cmdParameter = 789;
            let testExpression = seq(itemLabel(), cmd("foo", cmdParameter));
            rbi.addRule(testExpression, null);

            rbi.interpretUtterance(`${sharedLabel} foo`);
            // With omitted isGroup (null) both items are considered -> ambiguity -> no commands
            expect(normalItem.sendCommand.mock.calls.length).toBe(0);
            expect(groupItem.sendCommand.mock.calls.length).toBe(0);
        });
    });
});