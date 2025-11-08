jest.mock("openhab");
const openhab = require("openhab");
openhab.log = jest.fn().mockReturnValue({ info: jest.fn(), debug: jest.fn(), warn: jest.fn() });

const { tokenizeNormalized, getSynonymTokens, shortestExactMatchForItem, collectAllMatches, pickUniqueShortestMatch } = require("../lib/openHAB/ruleBasedInterpreter");

describe('matcher helpers', () => {
  test('shortestExactMatchForItem returns null if no exact match', () => {
    const item = { label: 'Living Room' };
    const tokens = ['kitchen'];
    const res = shortestExactMatchForItem(item, tokens);
    expect(res).toBeNull();
  });

  test('shortestExactMatchForItem prefers shortest between label and synonyms', () => {
    const item = {
      label: 'TV Room',
      getMetadata: jest.fn(ns => ns === 'synonyms' ? { value: 'TV' } : null)
    };

    const tokens = ['tv', 'room', 'foo'];
    const res = shortestExactMatchForItem(item, tokens);
    expect(res).not.toBeNull();
    expect(res.matchLength).toBe(1);
    expect(res.source).toBe('synonym');
  });

  test('collectAllMatches collects matches for multiple items', () => {
    const item1 = { label: 'TV', getMetadata: jest.fn() };
    const item2 = { label: 'Lamp', getMetadata: jest.fn() };
    const tokens = ['tv', 'on'];
    const matches = collectAllMatches([item1, item2], tokens);
    expect(matches.length).toBe(1);
    expect(matches[0].item).toBe(item1);
    expect(matches[0].matchLength).toBe(1);
  });

  test('pickUniqueShortestMatch returns null on ties', () => {
    const m1 = { item: { label: 'TV' }, matchLength: 1 };
    const m2 = { item: { label: 'Light' }, matchLength: 1 };
    const picked = pickUniqueShortestMatch([m1, m2]);
    expect(picked).toBeNull();
  });
});
