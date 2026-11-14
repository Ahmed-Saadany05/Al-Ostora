// Writes READ-ALOUD.txt: every Refaey line in play order, plain text, recorded facts filled in.
// Run: npx vite-node src/screens/home/refaey/facts/read-aloud.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INTRO, MISSIONS, MISSIONS_HUB, MOMENTS, OUTCOME, type DialogueNode, type Reply } from '../dialogues/dialogues';
import { athenaVerdict, recordedLabel, recordedTokens } from './display';
import { fill } from '../logic';

const facts = recordedTokens();
const fillF = (s: string) => fill(s, { horizons: false, values: {}, facts }) ?? `[${s.replace(/\{(\w+)\}/g, '$1').replace(/\s+/g, ' ')}: shown only with live data]`;
const live = (s: string) => s.replace(/\{(\w+)\}/g, '[$1]');

const out: string[] = [];
const say = (s = '') => out.push(s);
const node = (n: DialogueNode, liveOnly = false) => {
  for (const l of n.lines) say(liveOnly ? live(l) : fillF(l));
  say(`   (replies: ${n.replies.map((r: Reply) => `"${r.label}"`).join(' · ')})`);
  say();
};

say('REFAEY: READ ALOUD');
say(`Recorded facts: ${recordedLabel()}. Tokens in [square brackets] are live engine values: they appear only on the live provider.`);
say();
say('1. THE BRIEFING (after the flight, once per session)');
say('---------------------------------------------------');
INTRO.forEach((n) => node(n));
say('2. THREE LANDINGS, THREE LESSONS (the /missions page)');
say('---------------------------------------------------');
say('Page: "Three landings, three lessons". "Pick one. Refaey tells it in under a minute."');
node(MISSIONS_HUB);
for (const m of MISSIONS) {
  say(`${m.name.toUpperCase()}: ${m.outcome}`);
  say('');
  for (const n of m.story) {
    if (n.when === 'athenaSunlit' && athenaVerdict() !== 'sunlit') continue;
    if (n.when === 'athenaHidden' && athenaVerdict() !== 'hidden') continue;
    node(n);
  }
  say('   Final replies on the live provider: "See the sky at touchdown" · on the demo provider: "Open this site in the planner".');
  say();
}
say('3. ON THE PLANNING SCREENS (each card shows once per session)');
say('---------------------------------------------------');
MOMENTS.forEach((n) => node(n, true));
say('4. AFTER TOUCHDOWN (live provider only; the numbers come from the engine)');
say('---------------------------------------------------');
say('Waiting: "Give me a second…"');
say();
OUTCOME.forEach((n) => node(n, true));
writeFileSync(fileURLToPath(new URL('../READ-ALOUD.txt', import.meta.url)), out.join('\n') + '\n');
console.log(`${out.length} lines written`);
