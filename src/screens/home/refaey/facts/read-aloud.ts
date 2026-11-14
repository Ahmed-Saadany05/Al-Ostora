// Writes READ-ALOUD.txt: every Refaey line in play order, all branches, recorded facts and {callsign} filled in.
// Run: npx vite-node src/screens/home/refaey/facts/read-aloud.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXPLAINERS } from '../../explainers';
import { CALLSIGNS, DEFAULT_CALLSIGN, HUB, INTRO, MISSIONS, MOMENTS, OUTCOME, STAND, type DialogueNode, type Reply } from '../dialogues/dialogues';
import { SOURCE_CARDS } from '../dialogues/sourceCards';
import { fill } from '../logic';
import { athenaVerdict, recordedLabel, recordedTokens } from './display';

const facts = recordedTokens();
const story = { callsign: DEFAULT_CALLSIGN };
const f = (s: string) => fill(s, { horizons: false, values: {}, facts, story }) ?? `[${s.replace(/\{(\w+)\}/g, '$1').replace(/\s+/g, ' ')}: shown only with live data]`;
const live = (s: string) => fill(s, { horizons: false, values: {}, facts, story }) ?? s.replace(/\{(\w+)\}/g, '[$1]');

const out: string[] = [];
const say = (s = '') => out.push(s);

function replyText(r: Reply) {
  const target = r.next ? ` → ${r.next}` : r.action?.type === 'navigate' ? ` → ${r.action.to}` : r.action?.type === 'openExplainer' ? ` → explainer: ${r.action.id}` : r.action?.type === 'showSource' ? ` → source card: ${r.action.id}` : r.action?.type === 'openPlanner' ? ` → opens the planner at ${r.action.siteId}` : '';
  const label = f(r.label);
  return `[${label}${r.demoLabel ? ` (demo: ${r.demoLabel})` : ''}${r.callsign ? ` (sets the callsign)` : ''}]${target}`;
}
function node(n: DialogueNode, fill_: (s: string) => string = f) {
  say(`(${n.id}${n.when ? `, only when ${n.when}` : ''}${n.transition ? ', transition' : ''}${n.learns ? ', ends the story: lesson learned' : ''})`);
  for (const l of n.lines) say(fill_(l));
  say(`   replies: ${n.replies.map(replyText).join('  ')}`);
  say();
}

say('REFAEY: READ ALOUD (the story: Refaey is an astronaut whose launch slipped; you plan his new landing)');
say(`Fiction: Refaey, his lander, his delay and the callsign. Real and sourced: every mission, date and number. Recorded facts: ${recordedLabel()}.`);
say('Tokens in [square brackets] are live engine values: they appear only on the live provider. {callsign} is shown as the default, Ostora-1; the visitor picks Shams, Ostora-1 or Horus.');
say('On every briefing beat except the last there is also a "Skip" that jumps to the last beat (b7) with the default callsign.');
say();
say('1. THE BRIEFING (after the flight, once per session)');
say('---------------------------------------------------');
INTRO.forEach((n) => node(n));
say(`Callsign choices: ${CALLSIGNS.join(', ')}.`);
say();
say('2. THREE LANDINGS, THREE LESSONS (the /missions page)');
say('---------------------------------------------------');
say(`Title: "${HUB.title}"`);
say(`Subtitle: "${f(HUB.subtitle)}"`);
say(`Refaey, before any lesson: "${f(HUB.idle)}"`);
say(`Refaey, when all three are learned: "${f(HUB.allLearned)}"  [button: ${f(HUB.plan)}]`);
say(`Each finished story's card shows: "${HUB.learned}".`);
say();
for (const m of MISSIONS) {
  say(`${m.name.toUpperCase()} (${m.lesson}): ${m.outcome}`);
  say('');
  for (const n of m.story) {
    if (n.when === 'athenaSunlit' && athenaVerdict() !== 'sunlit') say('   (this variant is used if the engine verdict is "sunlit"; on our data the verdict is: ' + athenaVerdict() + ')');
    node(n);
  }
  say('   "How do you know?" cards used in this story:');
  for (const n of m.story)
    for (const r of n.replies)
      if (r.action?.type === 'showSource') {
        const c = SOURCE_CARDS[r.action.id];
        say(`   - ${r.action.id} (after ${n.id}): ${c.title}. ${c.says} ${c.href}`);
      }
  say();
}
say('3. ON THE PLANNING SCREENS (each card shows once per session)');
say('---------------------------------------------------');
say('If you skipped the briefing, the first card is preceded by a short introduction:');
MOMENTS.forEach((n) => node(n));
say('The Stand card (lines depend on what is true at that moment):');
say(`   ${f(STAND.hatch)}`);
say(`   Arriving from Compare dates, it starts: ${f(STAND.fromCompare)}`);
say(`   NASA LOLA skyline only: ${STAND.skyline}`);
say(`   Live provider only: ${live(STAND.live)}   or, if the live sky says so: ${STAND.dark}   /   ${STAND.noEarth}`);
say('   replies: [Why is the Sun so low?] → explainer: low-sun  [Looks good]');
say();
say('4. THE TOUCHDOWN (the ending; live provider: the numbers come from the engine)');
say('---------------------------------------------------');
say('While waiting (up to 15 s): "Give me a second…"');
say();
OUTCOME.forEach((n) => node(n, live));
say('5. EXPLAINERS REFAEY CAN OPEN (existing text)');
say('---------------------------------------------------');
for (const id of ['low-sun', 'farside', 'upright-panels']) {
  const e = (EXPLAINERS as Record<string, { title: string; body: string }>)[id];
  say(`${id}: ${e.title} ${e.body}`);
  say();
}
writeFileSync(fileURLToPath(new URL('../READ-ALOUD.txt', import.meta.url)), out.join('\n') + '\n');
console.log(`${out.length} lines written`);
