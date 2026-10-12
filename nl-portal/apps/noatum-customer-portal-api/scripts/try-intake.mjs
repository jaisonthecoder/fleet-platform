/*
 * Throwaway harness: runs a real PDF through the same two steps the endpoint does,
 * so the extraction and the rules can be checked without a browser session.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const API = 'C:/ADPORTS PROJECTS/NOATUM/Noatum Customer Portal/customer-platform/apps/noatum-customer-portal-api';
const env = readFileSync(`${API}/.env.local`, 'utf8');
const key = env.match(/^AI_ASSISTANT_API_KEY=(.+)$/m)[1].trim();
const model = env.match(/^AI_ASSISTANT_MODEL=(.+)$/m)[1].trim();

const PROMPT = readFileSync(`${API}/src/modules/ai-intake/gemini-intake.client.ts`, 'utf8')
  .match(/const PROMPT = `([\s\S]*?)`;/)[1];

// Container types straight from the lookup, as the service supplies them.
const containersJson = execFileSync('docker', [
  'exec', 'noatum-cp-postgres', 'psql', '-U', 'portal_owner', '-d', 'customer_platform',
  '-t', '-A', '-c',
  `SELECT json_agg(json_build_object('code', i.code, 'label', t.label, 'capacityM3', i.metadata->>'capacityM3', 'maxPayloadKg', i.metadata->>'maxPayloadKg', 'group', i.metadata->>'group'))
   FROM lookup_item i
   JOIN lookup_category c ON c.id = i.category_id AND c.code='container_type'
   JOIN lookup_item_translation t ON t.item_id=i.id AND t.locale='en-US'
   WHERE i.is_active AND i.is_customer_visible;`,
], { encoding: 'utf8' }).trim();

const containers = JSON.parse(containersJson).map((c) => ({
  code: c.code,
  label: c.label,
  capacityM3: c.capacityM3 === null ? undefined : Number(c.capacityM3),
  maxPayloadKg: c.maxPayloadKg === null ? undefined : Number(c.maxPayloadKg),
  group: c.group ?? undefined,
}));

async function extract(file) {
  const data = readFileSync(file).toString('base64');
  const payload = JSON.stringify({
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: 'application/pdf', data } },
      ],
    }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });

  for (const m of model.split(',').map((x) => x.trim())) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: payload,
      },
    );

    if (!res.ok) {
      console.log(`   ${m}: HTTP ${res.status}`);
      continue;
    }

    const body = await res.json();
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const start = text.indexOf('{');
    if (start < 0) { console.log(`   ${m}: no JSON`); continue; }
    console.log(`   answered by ${m}`);
    return JSON.parse(text.slice(start, text.lastIndexOf('}') + 1));
  }
  throw new Error('all models busy');
}

const rules = await import(`file:///${API}/dist/modules/ai-intake/intake-rules.js`);

for (const file of process.argv.slice(2)) {
  console.log('\n' + '='.repeat(70));
  console.log(file.split(/[\\/]/).pop());
  console.log('='.repeat(70));

  const facts = await extract(file);
  console.log('\n-- what Gemini read --');
  for (const [k, v] of Object.entries(facts)) if (v !== null && v !== '') console.log(`   ${k}: ${v}`);

  const free = `${facts.commodity ?? ''} ${facts.notes ?? ''}`;
  const temp = rules.detectTemperature(free, facts.temperatureSetPointCelsius);
  const hazard = rules.detectHazard(free, facts, ['1','2','3','4','5','6','7','8','9']);
  const equip = rules.proposeEquipment({
    volumeM3: facts.volumeM3,
    grossWeightKg: facts.grossWeightKg,
    containers,
    statedContainerCode: null,
    reefer: temp.temperature,
  });
  const scope = rules.proposeScope(facts.incoterm, false, false);

  console.log('\n-- what OUR RULES decided --');
  console.log(`   load type: ${equip.loadType}`);
  equip.equipment.forEach((e) => console.log(`   equipment: ${e.quantity} x ${e.containerType}  (${e.rule})`));
  console.log(`   scope:     ${scope.scope}  (${scope.rule ?? '-'})`);
  console.log(`   dangerous goods: ${hazard.dangerousGoods}  UN ${hazard.unNumber ?? '-'}  class ${hazard.hazardClass ?? '-'}`);
  console.log(`   temperature: ${temp.temperature}`);

  const questions = [
    ...rules.missingEssentials({
      originCode: facts.originCode ?? facts.originText,
      destinationCode: facts.destinationCode ?? facts.destinationText,
      readyDate: facts.readyDate,
      commodity: facts.commodity,
    }),
    ...scope.questions, ...equip.questions, ...hazard.questions, ...temp.questions,
  ];
  console.log('\n-- what it ASKS --');
  questions.forEach((q) => console.log(`   [${q.field}] ${q.ask}`));
}
