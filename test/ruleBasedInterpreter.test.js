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
const { RuleBasedInterpreter, alt, seq, opt, cmd, itemLabel, itemProperties } = require("../lib/openHAB/ruleBasedInterpreter");

let rbi = new RuleBasedInterpreter();

beforeEach(() => {
    rbi.clearRules();
    openhab.items.getItems.mockReturnValue([]);
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
            let itemOne = {sendCommand: jest.fn()};
            let itemTwo = {sendCommand: jest.fn()};
            let itemThree = {sendCommand: jest.fn()};
            let itemFour = {sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree, itemFour]);
            when(openhab.items.getItemsByTag).calledWith(...["bar"]).mockReturnValue([itemOne, itemThree]);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties("something", ["bar"], false),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemOne.sendCommand.mock.calls.length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(itemTwo.sendCommand.mock.calls.length).toBe(0);
            expect(itemThree.sendCommand.mock.calls.length).toBe(1);
            expect(itemThree.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemThree.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(itemFour.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by multiple tags", () => {
            let itemOne = {sendCommand: jest.fn()};
            let itemTwo = {sendCommand: jest.fn()};
            let itemThree = {sendCommand: jest.fn()};
            let itemFour = {sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree, itemFour]);
            when(openhab.items.getItemsByTag).calledWith(...["foo", "bar"]).mockReturnValue([itemOne, itemThree]);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties("something", ["foo", "bar"], false),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemOne.sendCommand.mock.calls.length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(itemTwo.sendCommand.mock.calls.length).toBe(0);
            expect(itemThree.sendCommand.mock.calls.length).toBe(1);
            expect(itemThree.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemThree.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(itemFour.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by type", () => {
            let itemOne = {type: "foobar", sendCommand: jest.fn()};
            let itemTwo = {type: "foo", sendCommand: jest.fn()};
            let itemThree = {type: "bar", sendCommand: jest.fn()};
            let itemFour = {type: "foo", sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree, itemFour]);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties("something", null, false, "foo"),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemTwo.sendCommand.mock.calls.length).toBe(1);
            expect(itemTwo.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemTwo.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(itemOne.sendCommand.mock.calls.length).toBe(0);
            expect(itemFour.sendCommand.mock.calls.length).toBe(1);
            expect(itemFour.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemFour.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(itemThree.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by type and tags", () => {
            let itemOne = {type: "foobar", sendCommand: jest.fn()};
            let itemTwo = {type: "foo", sendCommand: jest.fn()};
            let itemThree = {type: "bar", sendCommand: jest.fn()};
            let itemFour = {type: "foo", sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree, itemFour]);
            when(openhab.items.getItemsByTag).calledWith(...["foo", "bar"]).mockReturnValue([itemOne, itemTwo]);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties("something", ["foo", "bar"], false, "foo"),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemTwo.sendCommand.mock.calls.length).toBe(1);
            expect(itemTwo.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemTwo.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(itemOne.sendCommand.mock.calls.length).toBe(0);
            expect(itemFour.sendCommand.mock.calls.length).toBe(0);
            expect(itemThree.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by direct location and tag", () => {
            let itemOne = {name: "itemOne", label: "itemOne", groupNames: ["itemTwo"], sendCommand: jest.fn()};
            let itemTwo = {name: "itemTwo", label: "itemTwo", type: "Group", groupNames: ["itemThree"], sendCommand: jest.fn()};
            let itemThree = {name: "itemThree", label: "itemThree", type: "Group", groupNames: [], sendCommand: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree]);
            when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([itemOne, itemThree]);
            when(openhab.items.getItem).calledWith("itemTwo").mockReturnValue(itemTwo);
            when(openhab.items.getItem).calledWith("itemThree").mockReturnValue(itemThree);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something itemTwo works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemOne.sendCommand.mock.calls.length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(itemTwo.sendCommand.mock.calls.length).toBe(0);
            expect(itemThree.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by sub location and tag", () => {
            let itemOne = {name: "itemOne", label: "itemOne", groupNames: ["itemTwo"], sendCommand: jest.fn()};
            let itemTwo = {name: "itemTwo", label: "itemTwo", type: "Group", groupNames: ["itemThree"], sendCommand: jest.fn()};
            let itemThree = {name: "itemThree", label: "itemThree", type: "Group", groupNames: [], sendCommand: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree]);
            when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([itemOne]);
            when(openhab.items.getItem).calledWith("itemTwo").mockReturnValue(itemTwo);
            when(openhab.items.getItem).calledWith("itemThree").mockReturnValue(itemThree);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something itemThree works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemOne.sendCommand.mock.calls.length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(itemTwo.sendCommand.mock.calls.length).toBe(0);
            expect(itemThree.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by sub location and tag and type", () => {
            let itemOne = {name: "itemOne", label: "itemOne", type: "foobar", groupNames: ["itemTwo"], sendCommand: jest.fn()};
            let itemTwo = {name: "itemTwo", label: "itemTwo", type: "Group", groupNames: ["itemThree"], sendCommand: jest.fn()};
            let itemThree = {name: "itemThree", label: "itemThree", type: "Group", groupNames: [], sendCommand: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree]);
            when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([itemOne]);
            when(openhab.items.getItem).calledWith("itemTwo").mockReturnValue(itemTwo);
            when(openhab.items.getItem).calledWith("itemThree").mockReturnValue(itemThree);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true, "foobar"),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something itemThree works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemOne.sendCommand.mock.calls.length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(itemTwo.sendCommand.mock.calls.length).toBe(0);
            expect(itemThree.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends command to found items by self location and tag", () => {
            let itemOne = {name: "itemOne", label: "itemOne", type: "Group", groupNames: ["itemTwo"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let itemTwo = {name: "itemTwo", label: "itemTwo", type: "Group", groupNames: ["itemThree"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let itemThree = {name: "itemThree", label: "itemThree", type: "Group", groupNames: [], sendCommand: jest.fn(), getMetadata: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree]);
            when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([itemOne, itemThree]);
            when(openhab.items.getItem).calledWith("itemTwo").mockReturnValue(itemTwo);
            when(openhab.items.getItem).calledWith("itemThree").mockReturnValue(itemThree);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something itemOne works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemOne.sendCommand.mock.calls.length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
            expect(itemTwo.sendCommand.mock.calls.length).toBe(0);
            expect(itemThree.sendCommand.mock.calls.length).toBe(0);
        });

        it("sends no command if items are not in location", () => {
            let itemOne = {name: "itemOne", label: "itemOne", type: "Switch", groupNames: ["itemTwo"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let itemTwo = {name: "itemTwo", label: "itemTwo", type: "Group", groupNames: ["itemThree"], sendCommand: jest.fn(), getMetadata: jest.fn()};
            let itemThree = {name: "itemThree", label: "itemThree", type: "Group", groupNames: [], sendCommand: jest.fn(), getMetadata: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree]);
            when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([itemOne, itemThree]);
            when(openhab.items.getItem).calledWith("itemTwo").mockReturnValue(itemTwo);
            when(openhab.items.getItem).calledWith("itemThree").mockReturnValue(itemThree);
            
            let cmdParameter = 123;
            let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true),cmd("works", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("something itemOne works");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemOne.sendCommand.mock.calls.length).toBe(0);
            expect(itemTwo.sendCommand.mock.calls.length).toBe(0);
            expect(itemThree.sendCommand.mock.calls.length).toBe(0);
        });

        it("turns lights on in location", () => {
            let itemOne = {name: "itemOne", label: "itemOne", type: "Switch", groupNames: ["itemTwo"], sendCommand: jest.fn()};
            let itemTwo = {name: "itemTwo", label: "itemTwo", type: "Group", groupNames: ["itemThree"], sendCommand: jest.fn()};
            let itemThree = {name: "itemThree", label: "itemThree", type: "Group", groupNames: [], sendCommand: jest.fn()};
            
            openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree]);
            when(openhab.items.getItemsByTag).calledWith(...["Light"]).mockReturnValue([itemOne]);
            when(openhab.items.getItem).calledWith("itemTwo").mockReturnValue(itemTwo);
            when(openhab.items.getItem).calledWith("itemThree").mockReturnValue(itemThree);
            
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
            
            rbi.interpretUtterance("turn on all the lights in itemThree");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemOne.sendCommand.mock.calls.length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0][0]).toBe("ON");
            expect(itemTwo.sendCommand.mock.calls.length).toBe(0);
            expect(itemThree.sendCommand.mock.calls.length).toBe(0);
        });
    });

    describe("item expression", () => {
        it("sends command to found item by label", () => {
            let itemOne = {label: "item one", sendCommand: jest.fn()};
            let itemTwo = {label: "item two", sendCommand: jest.fn()};
            let itemThree = {label: "third item", sendCommand: jest.fn()};
            openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree]);
            
            let cmdParameter = 123;
            let testExpression = seq(itemLabel(),cmd("foo", cmdParameter));
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("item one foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemOne.sendCommand.mock.calls.length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

            rbi.interpretUtterance("item two foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemTwo.sendCommand.mock.calls.length).toBe(1);
            expect(itemTwo.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemTwo.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

            rbi.interpretUtterance("third item foo");
            expect(testFunction.mock.calls.length).toBe(0);
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
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            
            rbi.interpretUtterance("bar one foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemOne.sendCommand.mock.calls.length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

            rbi.interpretUtterance("barbar foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemOne.sendCommand.mock.calls.length).toBe(2);
            expect(itemOne.sendCommand.mock.calls[1].length).toBe(1);
            expect(itemOne.sendCommand.mock.calls[1][0]).toBe(cmdParameter);

            rbi.interpretUtterance("second bar foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemTwo.sendCommand.mock.calls.length).toBe(1);
            expect(itemTwo.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemTwo.sendCommand.mock.calls[0][0]).toBe(cmdParameter);

            rbi.interpretUtterance("bar three foo");
            expect(testFunction.mock.calls.length).toBe(0);
            expect(itemThree.sendCommand.mock.calls.length).toBe(1);
            expect(itemThree.sendCommand.mock.calls[0].length).toBe(1);
            expect(itemThree.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
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
            rbi.interpretUtterance("fo'o");
            expect(testFunction.mock.calls.length).toBe(0);
            rbi.interpretUtterance("foo'");
            expect(testFunction.mock.calls.length).toBe(0);
            rbi.interpretUtterance("fooö");
            expect(testFunction.mock.calls.length).toBe(0);
            rbi.interpretUtterance("fooò");
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