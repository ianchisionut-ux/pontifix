export type AccountOption = { code: string; name: string };
export const normalizeAccountText = (value: string) => value.toLocaleLowerCase('ro-RO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
export function filterAccounts(accounts: AccountOption[], query: string) {
  const words = normalizeAccountText(query).split(/\s+/).filter(Boolean);
  const rank = (account: AccountOption) => words.reduce((score, word) => score + (account.code.startsWith(word) ? 3 : normalizeAccountText(account.name).split(/[^a-z0-9]+/).some(token => token.startsWith(word)) ? 2 : 0), 0);
  return accounts.filter(account => words.every(word => normalizeAccountText(`${account.code} ${account.name}`).includes(word))).sort((a, b) => rank(b) - rank(a));
}
