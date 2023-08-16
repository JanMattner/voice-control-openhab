const {when} = require("jest-when");
jest.mock("openhab");
const openhab = require("openhab");
openhab.items = {
    getItems: jest.fn().mockReturnValue([]),
    getItemsByTag: jest.fn().mockReturnValue([]),
    getItem: jest.fn().mockReturnValue(null)
};
const { RuleBasedInterpreter, alt, seq, opt, cmd, itemLabel, itemProperties } = require("../lib/openHAB/ruleBasedInterpreter");

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
            let testExpression = seq(itemLabel(),cmd("foo", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("my item foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(retItem.sendCommand.mock.calls.length).toBe(1);
            expect(retItem.sendCommand.mock.calls[0].length).toBe(1);
            expect(retItem.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
        });
    });

    describe("item properties expression", () => {
        it("sends command to found items by single tag", () => {
            let item1 = {tags: ["foo", "bar"], sendCommand: jest.fn()};
            let item2 = {tags: ["foo"], sendCommand: jest.fn()};
            let item3 = {tags: ["bar"], sendCommand: jest.fn()};
            let item4 = {tags: ["test", "more", "tags"], sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([item1, item2, item3, item4]);
            when(openhab.items.getItemsByTag).calledWith(...["bar"]).mockReturnValue([item1, item3]);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties("something", ["bar"], false),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item1.sendCommand.mock.calls.length).toBe(1);
            expect(item1.sendCommand.mock.calls[0].length).toBe(1);
            expect(item1.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(item2.sendCommand.mock.calls.length).toBe(0);
            expect(item3.sendCommand.mock.calls.length).toBe(1);
            expect(item3.sendCommand.mock.calls[0].length).toBe(1);
            expect(item3.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(item4.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by multiple tags", () => {
            let item1 = {tags: ["foo", "bar"], sendCommand: jest.fn()};
            let item2 = {tags: ["foo", "b"], sendCommand: jest.fn()};
            let item3 = {tags: ["bar", "foo"], sendCommand: jest.fn()};
            let item4 = {tags: ["test", "more", "tags"], sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([item1, item2, item3, item4]);
            when(openhab.items.getItemsByTag).calledWith(...["foo", "bar"]).mockReturnValue([item1, item3]);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties("something", ["foo", "bar"], false),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item1.sendCommand.mock.calls.length).toBe(1);
            expect(item1.sendCommand.mock.calls[0].length).toBe(1);
            expect(item1.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(item2.sendCommand.mock.calls.length).toBe(0);
            expect(item3.sendCommand.mock.calls.length).toBe(1);
            expect(item3.sendCommand.mock.calls[0].length).toBe(1);
            expect(item3.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(item4.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by direct location", () => {
            let item1 = {name: "item1", label: "item1", semantics: { isLocation: false }, groupNames: ["item2"], sendCommand: jest.fn()};
            let item2 = {name: "item2", label: "item2", type: "GroupItem", semantics: { isLocation: true }, groupNames: ["item3"], sendCommand: jest.fn()};
            let item3 = {name: "item3", label: "item3", type: "GroupItem", semantics: { isLocation: true }, groupNames: [], sendCommand: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([item1, item2, item3]);
            when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([item1, item3]);
            when(openhab.items.getItem).calledWith("item2").mockReturnValue(item2);
            when(openhab.items.getItem).calledWith("item3").mockReturnValue(item3);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something item2 works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item1.sendCommand.mock.calls.length).toBe(1);
            expect(item1.sendCommand.mock.calls[0].length).toBe(1);
            expect(item1.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(item2.sendCommand.mock.calls.length).toBe(0);
            expect(item3.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by sub location", () => {
            let item1 = {name: "item1", label: "item1", semantics: { isLocation: false }, groupNames: ["item2"], sendCommand: jest.fn()};
            let item2 = {name: "item2", label: "item2", type: "GroupItem", semantics: { isLocation: true }, groupNames: ["item3"], sendCommand: jest.fn()};
            let item3 = {name: "item3", label: "item3", type: "GroupItem", semantics: { isLocation: true }, groupNames: [], sendCommand: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([item1, item2, item3]);
            when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([item1]);
            when(openhab.items.getItem).calledWith("item2").mockReturnValue(item2);
            when(openhab.items.getItem).calledWith("item3").mockReturnValue(item3);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something item3 works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item1.sendCommand.mock.calls.length).toBe(1);
            expect(item1.sendCommand.mock.calls[0].length).toBe(1);
            expect(item1.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(item2.sendCommand.mock.calls.length).toBe(0);
            expect(item3.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by self location", () => {
            let item1 = {name: "item1", label: "item1", type: "GroupItem", semantics: { isLocation: true }, groupNames: ["item2"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let item2 = {name: "item2", label: "item2", type: "GroupItem", semantics: { isLocation: true }, groupNames: ["item3"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let item3 = {name: "item3", label: "item3", type: "GroupItem", semantics: { isLocation: true }, groupNames: [], sendCommand: jest.fn(), getMetadata: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([item1, item2, item3]);
            when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([item1, item3]);
            when(openhab.items.getItem).calledWith("item2").mockReturnValue(item2);
            when(openhab.items.getItem).calledWith("item3").mockReturnValue(item3);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something item1 works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item1.sendCommand.mock.calls.length).toBe(1);
            expect(item1.sendCommand.mock.calls[0].length).toBe(1);
            expect(item1.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(item2.sendCommand.mock.calls.length).toBe(0);
            expect(item3.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends no command if items are not in location", () => {
            let item1 = {name: "item1", label: "item1", type: "SwitchItem", semantics: { isLocation: false }, groupNames: ["item2"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let item2 = {name: "item2", label: "item2", type: "GroupItem", semantics: { isLocation: true }, groupNames: ["item3"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let item3 = {name: "item3", label: "item3", type: "GroupItem", semantics: { isLocation: true }, groupNames: [], sendCommand: jest.fn(), getMetadata: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([item1, item2, item3]);
            when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([item1, item3]);
            when(openhab.items.getItem).calledWith("item2").mockReturnValue(item2);
            when(openhab.items.getItem).calledWith("item3").mockReturnValue(item3);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something item1 works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item1.sendCommand.mock.calls.length).toBe(0);
            expect(item2.sendCommand.mock.calls.length).toBe(0);
            expect(item3.sendCommand.mock.calls.length).toBe(0);
        });
    });

    describe("item expression", () => {
        it("sends command to found item by label", () => {
            let item1 = {label: "item one", sendCommand: jest.fn()};
            let item2 = {label: "item two", sendCommand: jest.fn()};
            let item3 = {label: "third item", sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([item1, item2, item3]);
            
            let cmdParameter = 123;
            let testExpression = seq(itemLabel(),cmd("foo", cmdParameter));
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
            let testExpression = seq(itemLabel(),cmd("foo", cmdParameter));
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