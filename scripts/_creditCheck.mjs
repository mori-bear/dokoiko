// Anthropic API クレジット残高の最小チェック。OK か NO_CREDITS / ERROR を出力。
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/moririn/MORI-LAB/projects/dokoiko-site/.env' });
const client = new Anthropic();
try {
  await client.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 1,
    messages: [{ role: 'user', content: 'hi' }],
  });
  console.log('OK');
} catch (e) {
  const msg = String(e.message || e);
  if (/credit balance is too low/i.test(msg)) console.log('NO_CREDITS');
  else console.log('ERROR ' + (e.status || '') + ' ' + msg.slice(0, 120));
}
