import { AiScopeService, type AiScopeResult } from '../src/ai/ai-scope.service';
import type { NormalizedStyleAdviceRequest } from '../src/ai/dto/style-advice.dto';

interface ScopeSmokeCase {
  prompt: string;
  expected: AiScopeResult;
}

const cases: ScopeSmokeCase[] = [
  {
    prompt: 'Recommend darkwear with boots and silver accessories.',
    expected: 'allowed',
  },
  {
    prompt: 'I want an all black gothic outfit for going out.',
    expected: 'allowed',
  },
  {
    prompt: 'No jacket, just tee, pants and shoes.',
    expected: 'allowed',
  },
  {
    prompt: 'Cho tui outfit streetwear có áo thun đen form rộng.',
    expected: 'allowed',
  },
  {
    prompt: 'tui muốn outfit đi cafe màu kem với quần jeans tầm 500k',
    expected: 'allowed',
  },
  { prompt: 'What is the weather today?', expected: 'out_of_scope' },
  { prompt: 'Explain JavaScript promises.', expected: 'out_of_scope' },
  { prompt: 'What is 2 + 2?', expected: 'out_of_scope' },
  {
    prompt: 'How do I pay my electricity bill?',
    expected: 'out_of_scope',
  },
  { prompt: 'Write me a database migration.', expected: 'out_of_scope' },
];

const scopeService = new AiScopeService();
const failures: string[] = [];

for (const smokeCase of cases) {
  const request: NormalizedStyleAdviceRequest = {
    notes: smokeCase.prompt,
    preferredColors: [],
    preferredSizes: [],
  };
  const decision = scopeService.evaluateStyleAdvice(request);

  console.log(
    `expected=${smokeCase.expected} actual=${decision.result} reasonCode=${decision.reasonCode} prompt=${JSON.stringify(smokeCase.prompt)}`,
  );

  if (decision.result !== smokeCase.expected) {
    failures.push(
      `${JSON.stringify(smokeCase.prompt)}: expected ${smokeCase.expected}, received ${decision.result}`,
    );
  }
}

if (failures.length > 0) {
  throw new Error(failures.join('\n'));
}
