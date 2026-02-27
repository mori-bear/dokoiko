export function buildExperienceLinks(city) {
  const area = city.affiliate.hotelArea;

  return [
    {
      type: 'jalan-exp',
      label: 'じゃらんで体験を探す',
      url: `https://www.jalan.net/activity/asp-webapp/web/WFsearch.do?keyword=${encodeURIComponent(area)}`,
    },
    {
      type: 'asoview',
      label: 'アソビューで体験を探す',
      url: `https://www.asoview.com/search/?keyword=${encodeURIComponent(area)}`,
    },
  ];
}
