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
const { RuleBasedInterpreter, alt, seq, opt, cmd, itemLabel, itemProperties, item } = require("../lib/openHAB/ruleBasedInterpreter");

let rbi = new RuleBasedInterpreter();

beforeEach(() => {
    rbi.clearRules();
    openhab.items.getItems.mockReturnValue([]);
});

describe("interpretUtterance", () => {

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
        
        describe("annotation result", () => {
            it("calls function after match but returns unsuccessful if function fails", () => {
                let testExpression = seq("bar", "foo", "foobar");
                let testFunction = jest.fn();
                testFunction.mockReturnValue(false);
                rbi.addRule(testExpression, testFunction);
                var result = rbi.interpretUtterance("bar foo foobar");
                expect(result.success).toBe(false);
                expect(testFunction.mock.calls.length).toBe(1);
            });

            it("annotates named function", () => {
                let testExpression = seq("bar", "foo", "foobar");
                let testFunction = function(){return true;};
                rbi.addRule(testExpression, testFunction);
                var result = rbi.interpretUtterance("bar foo foobar");
                expect(result.success).toBe(true);
                expect(result.executeFunction).toBe(testFunction.name);
            });

            it("annotates anonymous function", () => {
                let testExpression = seq("bar", "foo", "foobar");
                rbi.addRule(testExpression, function(myMarkerParam){return true;});
                var result = rbi.interpretUtterance("bar foo foobar");
                expect(result.success).toBe(true);
                expect(result.executeFunction).toContain("return true;");
                expect(result.executeFunction).toContain("myMarkerParam");
            });
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

    describe("executeFunction behavior", () => {
        it("executeFunction from rule overrides the one from the expression", () => {
            const itemOne = {name: "itemOne", label: "itemOne", sendCommand: jest.fn()};

            when(openhab.items.getItems).mockReturnValue([itemOne]);

            const func1 = jest.fn();

            // no executeFunction from rule, so the one from the expression is used
            rbi.addRule(seq(item(), cmd("foo", 123)), null);
            rbi.interpretUtterance("itemOne foo");

            expect(itemOne.sendCommand).toHaveBeenCalledWith(123);
            expect(func1).not.toHaveBeenCalled();

            // Reset
            func1.mockClear();
            itemOne.sendCommand.mockClear();
            rbi.clearRules();

            // executeFunction from rule should override the one from the expression
            rbi.addRule(seq(item(), cmd("foo", 123)), func1);
            rbi.interpretUtterance("itemOne foo");

            expect(func1).toHaveBeenCalled();
            expect(itemOne.sendCommand).not.toHaveBeenCalled();
        });

        it("executes function from rule even when no item expression is contained", () => {
            let testExpression = cmd("foo", 1);
            let testFunction = jest.fn();
            rbi.addRule(testExpression, testFunction);
            rbi.interpretUtterance("foo");
            expect(testFunction).toHaveBeenCalledTimes(1);
        });

        it("executeFunction from rule is called with correct parameters", () => {
            const itemA = {name: "itemA", label: "itemA", sendCommand: jest.fn()};
            const itemB = {name: "itemB", label: "itemB", sendCommand: jest.fn()};

            when(openhab.items.getItems).mockReturnValue([itemA, itemB]);
            when(openhab.items.getItemsByTag).calledWith(...["tagX"]).mockReturnValue([itemA, itemB]);

            const func1 = jest.fn();

            // no executeFunction from rule, so the one from the expression is used. Called with both items.
            rbi.addRule(seq(item({tag: "tagX", matchMultiple: true}, {expr: "bar"}), cmd("foo", 123)), func1);
            rbi.interpretUtterance("bar foo");

            expect(itemA.sendCommand).not.toHaveBeenCalled();
            expect(itemB.sendCommand).not.toHaveBeenCalled();
            expect(func1).toHaveBeenCalledTimes(1);
            expect(func1).toHaveBeenCalledWith({items: [itemA, itemB]});

            // reset
            itemA.sendCommand.mockClear();
            itemB.sendCommand.mockClear();
            func1.mockClear();
            rbi.clearRules();

            // no executeFunction from rule, so the one from the expression is used. Called with single item.
            rbi.addRule(seq(item(), cmd("foo", 123)), func1);
            rbi.interpretUtterance("itemB foo");

            expect(itemA.sendCommand).not.toHaveBeenCalled();
            expect(itemB.sendCommand).not.toHaveBeenCalled();
            expect(func1).toHaveBeenCalledTimes(1);
            expect(func1).toHaveBeenCalledWith({items: [itemB]});
        });
    });
});