const acronyms = new Set(['PDO', 'PGI', 'GMO', 'MSG', 'BHA', 'BHT', 'TBHQ', 'UHT', 'GF', 'BBQ']);

export function titleCaseIngredients(text) {
  return text.replace(/[\p{L}\p{M}\p{N}]+/gu, word => {
    if (!/^(?:\p{Lu}\p{M}*){2,}$/u.test(word) || acronyms.has(word)) return word;
    const [first, ...rest] = word;
    return first + rest.join('').toLowerCase();
  });
}
