const cheerio = require('cheerio');

const KEYWORDS = [
  'unsubscribe',
  'opt-out',
  'opt out',
  'remove me',
  'stop receiving',
  'cancel subscription',
  'manage preferences',
];

function findLinks(emailBody) {
  if (!emailBody) return [];

  const $ = cheerio.load(emailBody);
  const links = new Set();

  $('a').each((_, link) => {
    const text = $(link).text().toLowerCase();
    const href = $(link).attr('href');

    if (!href?.startsWith('http')) return;

    if (KEYWORDS.some((keyword) => text.includes(keyword))) {
      links.add(href);
    }
  });

  const meta = $('meta[name="List-Unsubscribe"]').attr('content');
  if (meta) {
    const matches = meta.match(/<(https?:\/\/[^>]+)>/g);
    if (matches) {
      matches.forEach((match) => links.add(match.slice(1, -1)));
    } else if (meta.startsWith('http')) {
      links.add(meta);
    }
  }

  return Array.from(links);
}

module.exports = {
  findLinks,
};
