// Example plugin: tags every chat completion with a "watermark" note in
// the system prompt. Edit or replace this file to experiment with
// custom behaviour. Restart the server after editing.

module.exports = async function watermarkPlugin(event, payload, ctx) {
  if (event === 'pre-chat' && payload && payload.system_prompt) {
    payload.system_prompt += '\n\n[watermark: local-chatbot]';
  }
  return payload;
};
