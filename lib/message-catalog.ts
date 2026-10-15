export function readFlatMessages(text: string) {
  const messages: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    let value = match[2] ?? '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
    messages[match[1]!] = value;
  }
  return messages;
}

type Substitutions = string | number | Array<string | number> | Record<string, string | number>;

export function translate(messages: Record<string, string>, key: string, substitutions?: Substitutions) {
  let message = messages[key] ?? '';
  if (substitutions && typeof substitutions === 'object' && !Array.isArray(substitutions)) {
    for (const [name, value] of Object.entries(substitutions)) message = message.replaceAll(`{${name}}`, String(value));
    return message;
  }
  const values = substitutions === undefined ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
  for (const [index, value] of values.entries()) message = message.replaceAll(`$${index + 1}`, String(value));
  return message;
}
