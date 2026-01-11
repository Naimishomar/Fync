// services/musicService.ts

// ==========================
// 📻 LIVE RADIO BY CATEGORY
// ==========================
const RADIO_API = 'https://de1.api.radio-browser.info/json';

// Map app categories → radio tags
const RADIO_CATEGORIES: Record<string, string> = {
  bollywood: 'hindi',
  lofi: 'lofi',
  study: 'chill',
  punjabi: 'punjabi',
  english: 'pop'
};

export const fetchRadioByCategory = async (category: string) => {
  const tag = RADIO_CATEGORIES[category] || 'music';

  const response = await fetch(
    `${RADIO_API}/stations/bytag/${tag}`
  );
  const data = await response.json();

  return data
    .filter((s: any) => s.url_resolved)
    .slice(0, 20)
    .map((station: any) => ({
      id: station.stationuuid,
      name: station.name,
      streamUrl: station.url_resolved,
      artwork: station.favicon || 'https://via.placeholder.com/300',
      tags: station.tags
    }));
};
