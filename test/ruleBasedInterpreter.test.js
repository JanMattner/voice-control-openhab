const {when} = require("jest-when");
jest.mock("openhab");
const openhab = require("openhab");
openhab.items = {
    getItems: jest.fn().mockReturnValue([]),
    getItemsByTag: jest.fn().mockReturnValue([]),
    getItem: jest.fn().mockReturnValue(null)
};
openhab.log = jest.fn().mockReturnValue({
    info: console.log,
    debug: console.debug
});
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
            let item1 = {sendCommand: jest.fn()};
            let item2 = {sendCommand: jest.fn()};
            let item3 = {sendCommand: jest.fn()};
            let item4 = {sendCommand: jest.fn()};
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
            let item1 = {sendCommand: jest.fn()};
            let item2 = {sendCommand: jest.fn()};
            let item3 = {sendCommand: jest.fn()};
            let item4 = {sendCommand: jest.fn()};
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

        it("sends command to found items by type", () => {
            let item1 = {type: "foobar", sendCommand: jest.fn()};
            let item2 = {type: "foo", sendCommand: jest.fn()};
            let item3 = {type: "bar", sendCommand: jest.fn()};
            let item4 = {type: "foo", sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([item1, item2, item3, item4]);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties("something", null, false, "foo"),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item2.sendCommand.mock.calls.length).toBe(1);
            expect(item2.sendCommand.mock.calls[0].length).toBe(1);
            expect(item2.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(item1.sendCommand.mock.calls.length).toBe(0);
            expect(item4.sendCommand.mock.calls.length).toBe(1);
            expect(item4.sendCommand.mock.calls[0].length).toBe(1);
            expect(item4.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(item3.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by type and tags", () => {
            let item1 = {type: "foobar", sendCommand: jest.fn()};
            let item2 = {type: "foo", sendCommand: jest.fn()};
            let item3 = {type: "bar", sendCommand: jest.fn()};
            let item4 = {type: "foo", sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([item1, item2, item3, item4]);
            when(openhab.items.getItemsByTag).calledWith(...["foo", "bar"]).mockReturnValue([item1, item2]);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties("something", ["foo", "bar"], false, "foo"),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item2.sendCommand.mock.calls.length).toBe(1);
            expect(item2.sendCommand.mock.calls[0].length).toBe(1);
            expect(item2.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(item1.sendCommand.mock.calls.length).toBe(0);
            expect(item4.sendCommand.mock.calls.length).toBe(0);
            expect(item3.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by direct location and tag", () => {
            let item1 = {name: "item1", label: "item1", groupNames: ["item2"], sendCommand: jest.fn()};
            let item2 = {name: "item2", label: "item2", type: "Group", groupNames: ["item3"], sendCommand: jest.fn()};
            let item3 = {name: "item3", label: "item3", type: "Group", groupNames: [], sendCommand: jest.fn()};
            
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

        it("sends command to found items by sub location and tag", () => {
            let item1 = {name: "item1", label: "item1", groupNames: ["item2"], sendCommand: jest.fn()};
            let item2 = {name: "item2", label: "item2", type: "Group", groupNames: ["item3"], sendCommand: jest.fn()};
            let item3 = {name: "item3", label: "item3", type: "Group", groupNames: [], sendCommand: jest.fn()};
            
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

        it("sends command to found items by sub location and tag and type", () => {
            let item1 = {name: "item1", label: "item1", type: "foobar", groupNames: ["item2"], sendCommand: jest.fn()};
            let item2 = {name: "item2", label: "item2", type: "Group", groupNames: ["item3"], sendCommand: jest.fn()};
            let item3 = {name: "item3", label: "item3", type: "Group", groupNames: [], sendCommand: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([item1, item2, item3]);
            when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([item1]);
            when(openhab.items.getItem).calledWith("item2").mockReturnValue(item2);
            when(openhab.items.getItem).calledWith("item3").mockReturnValue(item3);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true, "foobar"),cmd("works", cmdParameter));
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

        it("sends command to found items by self location and tag", () => {
            let item1 = {name: "item1", label: "item1", type: "Group", groupNames: ["item2"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let item2 = {name: "item2", label: "item2", type: "Group", groupNames: ["item3"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let item3 = {name: "item3", label: "item3", type: "Group", groupNames: [], sendCommand: jest.fn(), getMetadata: jest.fn()};
            
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
            let item1 = {name: "item1", label: "item1", type: "Switch", groupNames: ["item2"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let item2 = {name: "item2", label: "item2", type: "Group", groupNames: ["item3"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let item3 = {name: "item3", label: "item3", type: "Group", groupNames: [], sendCommand: jest.fn(), getMetadata: jest.fn()};
            
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

        it("turns lights on in location", () => {
            let item1 = {name: "item1", label: "item1", type: "Switch", groupNames: ["item2"], sendCommand: jest.fn()};
            let item2 = {name: "item2", label: "item2", type: "Group", groupNames: ["item3"], sendCommand: jest.fn()};
            let item3 = {name: "item3", label: "item3", type: "Group", groupNames: [], sendCommand: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([item1, item2, item3]);
            when(openhab.items.getItemsByTag).calledWith(...["Light"]).mockReturnValue([item1]);
            when(openhab.items.getItem).calledWith("item2").mockReturnValue(item2);
            when(openhab.items.getItem).calledWith("item3").mockReturnValue(item3);
            
            let onOff = alt(cmd("on", "ON"), cmd("off", "OFF"));
            let turn = alt("turn", "switch");
            let the = opt("the");
            let inOfThe = seq(alt("in", "of"), the);
            let allThe = alt(seq("all", the), the);
            let lights = alt("light", "lights");
            let testExpression = seq(
                turn,
                opt(onOff),
                allThe,
                itemProperties(
                    seq(
                        lights,
                        opt(onOff),
                        inOfThe,
                        itemLabel(false, true)),
                    ["Light"], true, "Switch"),
                opt(onOff))
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("turn on all the lights in item3");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(item1.sendCommand.mock.calls.length).toBe(1);
            expect(item1.sendCommand.mock.calls[0].length).toBe(1);
            expect(item1.sendCommand.mock.calls[0][0]).toBe("ON");
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

        it("is successful at the end when no tokens are left", () => {
            let testExpression = seq("first", alt("second", opt("foo")), opt("bar"));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("first second");
            expect(testFunction.mock.calls.length).toBe(1);
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