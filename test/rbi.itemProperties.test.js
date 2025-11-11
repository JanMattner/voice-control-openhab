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

describe("itemProperties expression", () => {
    it("sends command to found items by single tag", () => {
        let itemOne = {sendCommand: jest.fn()};
        let itemTwo = {sendCommand: jest.fn()};
        let itemThree = {sendCommand: jest.fn()};
        let itemFour = {sendCommand: jest.fn()};
        openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree, itemFour]);
        when(openhab.items.getItemsByTag).calledWith(...["bar"]).mockReturnValue([itemOne, itemThree]);
        
        let cmdParameter = 123;
        let testExpression = seq(itemProperties("something", ["bar"], false),cmd("works", cmdParameter));
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("something works");
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
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("something works");
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
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("something works");
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
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("something works");
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
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("something itemTwo works");
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
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("something itemThree works");
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
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("something itemThree works");
        expect(itemOne.sendCommand.mock.calls.length).toBe(1);
        expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
        expect(itemOne.sendCommand.mock.calls[0][0]).toBe(cmdParameter);
        expect(itemTwo.sendCommand.mock.calls.length).toBe(0);
        expect(itemThree.sendCommand.mock.calls.length).toBe(0);
    });

    it("does not match the parent group itself", () => {
        let itemOne = {name: "itemOne", label: "itemOne", type: "Group", groupNames: ["itemTwo"], sendCommand: jest.fn(), getMetadata: jest.fn()};
        let itemTwo = {name: "itemTwo", label: "itemTwo", type: "Group", groupNames: ["itemThree"], sendCommand: jest.fn(), getMetadata: jest.fn()};
        let itemThree = {name: "itemThree", label: "itemThree", type: "Group", groupNames: [], sendCommand: jest.fn(), getMetadata: jest.fn()};
        
        openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree]);
        when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([itemOne, itemThree]);
        when(openhab.items.getItem).calledWith("itemTwo").mockReturnValue(itemTwo);
        when(openhab.items.getItem).calledWith("itemThree").mockReturnValue(itemThree);
        
        let cmdParameter = 123;
        let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true),cmd("works", cmdParameter));
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("something itemOne works");
        expect(itemOne.sendCommand.mock.calls.length).toBe(0);
        expect(itemTwo.sendCommand.mock.calls.length).toBe(0);
        expect(itemThree.sendCommand.mock.calls.length).toBe(0);
    });

    it("does not match non-group item if group is required", () => {
        let itemOne = {name: "itemOne", label: "itemOne", type: "Switch", groupNames: ["itemTwo"], sendCommand: jest.fn(), getMetadata: jest.fn()};
        let itemTwo = {name: "itemTwo", label: "itemTwo", type: "Group", groupNames: ["itemThree"], sendCommand: jest.fn(), getMetadata: jest.fn()};
        let itemThree = {name: "itemThree", label: "itemThree", type: "Group", groupNames: [], sendCommand: jest.fn(), getMetadata: jest.fn()};
        
        openhab.items.getItems.mockReturnValue([itemOne, itemTwo, itemThree]);
        when(openhab.items.getItemsByTag).calledWith(...["foo"]).mockReturnValue([itemOne, itemThree]);
        when(openhab.items.getItem).calledWith("itemTwo").mockReturnValue(itemTwo);
        when(openhab.items.getItem).calledWith("itemThree").mockReturnValue(itemThree);
        
        let cmdParameter = 123;
        let testExpression = seq(itemProperties(seq("something",itemLabel(false, true)), ["foo"], true),cmd("works", cmdParameter));
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("something itemOne works");
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
        rbi.addRule(testExpression, null);
        
        rbi.interpretUtterance("turn on all the lights in itemThree");
        expect(itemOne.sendCommand.mock.calls.length).toBe(1);
        expect(itemOne.sendCommand.mock.calls[0].length).toBe(1);
        expect(itemOne.sendCommand.mock.calls[0][0]).toBe("ON");
        expect(itemTwo.sendCommand.mock.calls.length).toBe(0);
        expect(itemThree.sendCommand.mock.calls.length).toBe(0);
    });
});