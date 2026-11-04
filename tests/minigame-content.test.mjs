import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MISSIONS, STORY } from '../missions-data.js';
import { getArcadeData, getKnowledgeDetails, NPC_LINES } from '../minigames/content.js';

const length = text => [...text].length;

test('unrequested mission content is preserved outside mission6 and two food-chain project examples', () => {
  const retained=MISSIONS.filter(m=>m.id!==6).map(m=>m.id===2?{...m,cards:m.cards.map(c=>['c-goal','c-format'].includes(c.id)?{...c,text:'PROJECT_EXAMPLE'}:c)}:m);
  const hash=createHash('sha256').update(JSON.stringify(retained)).digest('hex');
  assert.equal(hash,'3f698d58caa0a17abe038434b393c70bf5677f442b004f9c1006a3f7e4512947');
  assert.match(STORY.opening[0].text,/오후 4시\./);
  assert.match(STORY.opening[1].text,/40분 남았다/);
});

test('OX runs retain original truth values and attach the full source explanations', () => {
  const data = getArcadeData(MISSIONS[0]).arcade;
  assert.equal(data.questions.length, 5);
  assert.deepEqual(data.questions.slice(0, 3).map(q => q.answer), MISSIONS[0].items.map(q => q.answer));
  assert.deepEqual(data.questions.slice(3).map(q => q.answer), [false, true]);
  for (const question of data.questions) {
    assert.ok(length(question.text) <= 30);
    assert.ok(length(question.tip) <= 30);
    assert.equal(question.explanation, MISSIONS[0].items[question.sourceIndex].explanation);
  }
});

test('coffee cards preserve the five source slots and both distractors', () => {
  const data = getArcadeData(MISSIONS[1]).arcade;
  assert.deepEqual(data.slots.map(s => s.id), ['role', 'audience', 'goal', 'constraints', 'format']);
  assert.equal(data.cards.filter(c => c.good).length, 5);
  assert.equal(data.cards.filter(c => !c.good).length, 2);
  for (const card of data.cards) {
    const source = MISSIONS[1].cards.find(c => c.id === card.id);
    assert.equal(card.slot, source.slot);
    assert.equal(card.originalText, source.text);
  }
  assert.equal(data.assembly.length, 5);
  assert.ok(data.assembly.every(c => c.text.length > 0));
});

test('phone choices retain the source answer order and fit short reading windows', () => {
  const calls = getArcadeData(MISSIONS[2]).arcade.calls;
  assert.equal(calls.length, 5);
  assert.deepEqual(calls.map(c => c.answer), [0, 1, 0, 1, 1]);
  calls.forEach((call, i) => {
    assert.ok(length(call.parent) <= 25);
    assert.ok(length(call.tip) <= 30);
    assert.ok(call.choices.every(choice => length(choice) <= 15));
    assert.deepEqual(call.originalOptions, MISSIONS[2].items[i].options);
  });
});

test('NPC lines fit one 25-character bubble and all ten missions have lines', () => {
  assert.equal(Object.keys(NPC_LINES).length, 10);
  for (const lines of Object.values(NPC_LINES)) assert.ok(lines.every(line => length(line) <= 25));
});

test('adapters do not mutate source missions and all ten have isolated arcade data', () => {
  const before = JSON.stringify(MISSIONS);
  for (const mission of MISSIONS) {
    const presentation = getArcadeData(mission);
    assert.ok(presentation.arcade?.title);
    const details = getKnowledgeDetails(mission);
    assert.ok(details.some(d => d.explanation === mission.explanation));
  }
  assert.equal(JSON.stringify(MISSIONS), before);
});

test('knowledge cards retain the full correct choices hidden during fast play', () => {
  const ox = getKnowledgeDetails(MISSIONS[0]);
  assert.deepEqual(ox.slice(0, 3).map(d => d.answer), ['O · 맞는 설명', 'X · 틀린 설명', 'O · 맞는 설명']);
  const coffee = getKnowledgeDetails(MISSIONS[1]);
  assert.equal(coffee.length, 6);
  MISSIONS[1].slots.forEach((slot, i) => {
    assert.equal(coffee[i].question, slot.label);
    assert.equal(coffee[i].answer, MISSIONS[1].cards.find(card => card.slot === slot.id).text);
  });
  const calls = getKnowledgeDetails(MISSIONS[2]);
  MISSIONS[2].items.forEach((item, i) => assert.equal(calls[i].answer, item.options[item.answer]));
});
